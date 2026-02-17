package com.catrun404.bpmndiff.toolWindow

import com.catrun404.bpmndiff.BpmnDiffBundle
import com.catrun404.bpmndiff.actions.BpmnDiffOpenInAssociatedApplicationAction
import com.catrun404.bpmndiff.git.BpmnDiffGitService
import com.catrun404.bpmndiff.settings.BpmnDiffSettingsState
import com.catrun404.bpmndiff.toolWindow.BpmnDiffConstants.BPMN_DIFF_SERVICE_PAGE_URL
import com.catrun404.bpmndiff.toolWindow.BpmnDiffConstants.BPMN_DIFF_SERVICE_URL
import com.catrun404.bpmndiff.toolWindow.BpmnDiffConstants.BRANCH_MODE
import com.catrun404.bpmndiff.toolWindow.BpmnDiffConstants.COMMIT_MODE
import com.catrun404.bpmndiff.toolWindow.BpmnDiffConstants.MANUAL_MODE
import com.catrun404.bpmndiff.toolWindow.BpmnDiffConstants.SCHEME
import com.catrun404.bpmndiff.toolWindow.BpmnDiffConstants.SERVICE_DOMAIN
import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.*
import com.intellij.openapi.actionSystem.ex.ComboBoxAction
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileChooser.FileChooser
import com.intellij.openapi.fileChooser.FileChooserDescriptor
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Key
import com.intellij.openapi.util.text.StringUtil
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import com.intellij.util.ui.JBUI
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import org.cef.network.CefRequest
import java.awt.BorderLayout
import java.awt.Dimension
import java.io.File
import java.util.*
import javax.swing.JComponent
import javax.swing.JPanel

class BpmnDiffToolWindow(
    private val project: Project,
    private val onTitleChange: (String) -> Unit
) {
    private val browser = JBCefBrowser()
    private val jsQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)
    private var toolbar: ActionToolbar? = null
    private var currentFile: File? = null
    private var currentVirtualFile: VirtualFile? = null

    private var mode = BRANCH_MODE
    private var branches = listOf<String>()
    private var files = listOf<String>()
    private var commits = listOf<Pair<String, String>>()
    private var selectedLeftBranch: String? = null
    private var selectedRightBranch: String? = null
    private var selectedLeftCommit: String? = null
    private var selectedRightCommit: String? = null
    private var selectedFile: String? = null
    private var manualLeftFileName: String? = null
    private var manualRightFileName: String? = null
    private var showDiff: Boolean = true

    companion object {
        val KEY = Key.create<BpmnDiffToolWindow>("BpmnDiffToolWindow")
        val DATA_KEY = DataKey.create<BpmnDiffToolWindow>("BpmnDiffToolWindow")
    }

    init {
        setupResourceHandler()
        fetchBranches()
        jsQuery.addHandler { msg ->
            try {
                when {
                    msg.startsWith("title:") -> {
                        onTitleChange(msg.removePrefix("title:"))
                    }

                    msg.startsWith("file:") -> {
                        val path = msg.removePrefix("file:")
                        if (path.isNotEmpty()) {
                            val gitService = BpmnDiffGitService.getInstance(project)
                            val repository = gitService.getFirstRepository()
                            if (repository != null) {
                                val file = File(repository.root.path, path)
                                val virtualFile = repository.root.findFileByRelativePath(path)
                                ApplicationManager.getApplication().invokeLater {
                                    selectedFile = path
                                    currentFile = file
                                    currentVirtualFile = virtualFile
                                }
                            } else {
                                ApplicationManager.getApplication().invokeLater {
                                    selectedFile = null
                                    currentFile = null
                                    currentVirtualFile = null
                                }
                            }
                        } else {
                            ApplicationManager.getApplication().invokeLater {
                                selectedFile = null
                                currentFile = null
                                currentVirtualFile = null
                            }
                        }
                    }
                }
            } catch (_: Exception) {
                // Ignore
            }
            null
        }
        browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(browser: CefBrowser?, frame: CefFrame?, httpStatusCode: Int) {
                if (frame?.isMain == true) {
                    val left = if (isCommitModeActive()) (selectedLeftCommit ?: "") else (selectedLeftBranch ?: "")
                    val right = if (isCommitModeActive()) (selectedRightCommit ?: "") else (selectedRightBranch ?: "")
                    val file = selectedFile?.replace("\\", "/") ?: ""
                    val script = """
                        window.setTabTitle = function(title) { 
                            ${jsQuery.inject("'title:' + title")} 
                        };
                        window.setSelectedFile = function(path) {
                            ${jsQuery.inject("'file:' + path")}
                        };
                        if (window.initFromIJ) {
                            window.initFromIJ('$mode', '$left', '$right', '$file', $showDiff);
                        }
                    """.trimIndent()
                    browser?.executeJavaScript(script, browser.url, 0)
                }
            }
        }, browser.cefBrowser)
    }

    private fun fetchBranches() {
        val gitService = BpmnDiffGitService.getInstance(project)
        val repository = gitService.getFirstRepository() ?: return
        ProgressManager.getInstance()
            .run(object : Task.Backgroundable(project, BpmnDiffBundle.message("progress.fetching.branches"), false) {
                override fun run(indicator: ProgressIndicator) {
                    val branchData = gitService.fetchBranches(repository)

                    ApplicationManager.getApplication().invokeLater {
                        if (project.isDisposed) return@invokeLater
                        branches = branchData.map { it.first }

                        val settings = BpmnDiffSettingsState.getInstance(project).state
                        val defaultLeft = settings.defaultLeftBranch

                        if (selectedLeftBranch == null) {
                            selectedLeftBranch = when {
                                branches.contains(defaultLeft) -> defaultLeft
                                branches.contains("master") -> "master"
                                branches.contains("main") -> "main"
                                else -> branches.firstOrNull()
                            }
                        }
                        if (selectedRightBranch == null) {
                            selectedRightBranch = branchData.find { it.second }?.first ?: branches.firstOrNull()
                        }
                        updateFiles()
                    }
                }
            })
    }

    private fun fetchCommits() {
        val gitService = BpmnDiffGitService.getInstance(project)
        val repository = gitService.getFirstRepository() ?: return
        ProgressManager.getInstance()
            .run(object : Task.Backgroundable(project, BpmnDiffBundle.message("progress.fetching.commits"), false) {
                override fun run(indicator: ProgressIndicator) {
                    val commitData = gitService.fetchCommits(repository)

                    ApplicationManager.getApplication().invokeLater {
                        if (project.isDisposed) return@invokeLater
                        commits = commitData

                        if (selectedRightCommit == null) {
                            selectedRightCommit = commitData.firstOrNull()?.first
                        }
                        if (selectedLeftCommit == null) {
                            selectedLeftCommit =
                                if (commitData.size > 1) commitData[1].first else commitData.firstOrNull()?.first
                        }
                        updateFiles()
                    }
                }
            })
    }

    private fun updateFiles() {
        val gitService = BpmnDiffGitService.getInstance(project)
        val repository = gitService.getFirstRepository() ?: return

        val leftRef = when {
            isBranchModeActive() -> selectedLeftBranch
            isCommitModeActive() -> selectedLeftCommit
            else -> null
        } ?: return

        val rightRef = when {
            isBranchModeActive() -> selectedRightBranch
            isCommitModeActive() -> selectedRightCommit
            else -> null
        } ?: return

        ProgressManager.getInstance()
            .run(object : Task.Backgroundable(project, BpmnDiffBundle.message("progress.updating.files"), false) {
                override fun run(indicator: ProgressIndicator) {
                    val foundFiles = gitService.getChangedBpmnFiles(repository, leftRef, rightRef)
                    ApplicationManager.getApplication().invokeLater {
                        if (project.isDisposed) return@invokeLater
                        files = foundFiles
                        if (selectedFile !in files) {
                            selectedFile = files.firstOrNull()
                        }
                        updateCurrentFile()
                        updateWeb()
                    }
                }
            })
    }

    private fun updateCurrentFile() {
        val gitService = BpmnDiffGitService.getInstance(project)
        val repository = gitService.getFirstRepository()
        if (repository != null && selectedFile != null) {
            currentFile = File(repository.root.path, selectedFile!!)
            currentVirtualFile = repository.root.findFileByRelativePath(selectedFile!!)
        } else {
            currentFile = null
            currentVirtualFile = null
        }
    }

    private fun updateWeb() {
        val left = when {
            isBranchModeActive() -> selectedLeftBranch ?: ""
            isCommitModeActive() -> selectedLeftCommit ?: ""
            else -> ""
        }
        val right = when {
            isBranchModeActive() -> selectedRightBranch ?: ""
            isCommitModeActive() -> selectedRightCommit ?: ""
            else -> ""
        }
        val file = selectedFile?.replace("\\", "/") ?: ""
        val script = "if (window.setGitSelection) { window.setGitSelection('$left', '$right', '$file'); }"
        browser.cefBrowser.executeJavaScript(script, browser.cefBrowser.url, 0)
    }

    private fun setupResourceHandler() {
        val schemeHandlerFactory = { _: CefBrowser?, _: CefFrame?, _: String?, request: CefRequest? ->
            val url = request?.url ?: ""
            if (url.startsWith(BPMN_DIFF_SERVICE_URL)) {
                BpmnDiffResourceHandler(project)
            } else {
                null
            }
        }
        CefApp.getInstance()
            .registerSchemeHandlerFactory(SCHEME, SERVICE_DOMAIN, schemeHandlerFactory)
    }

    fun getContent(): JComponent {
        browser.loadURL(BPMN_DIFF_SERVICE_PAGE_URL)

        val panel = object : JPanel(BorderLayout()), DataProvider {
            override fun getData(dataId: String): Any? {
                if (DATA_KEY.`is`(dataId)) {
                    return this@BpmnDiffToolWindow
                }
                if (CommonDataKeys.VIRTUAL_FILE.`is`(dataId)) {
                    return currentVirtualFile
                }
                if (CommonDataKeys.PROJECT.`is`(dataId)) {
                    return project
                }
                return null
            }
        }
        panel.border = JBUI.Borders.empty()

        val toolbar = createToolbar(panel)
        panel.add(toolbar.component, BorderLayout.NORTH)
        panel.add(browser.component, BorderLayout.CENTER)
        this.toolbar = toolbar
        return panel
    }

    private fun createToolbar(targetComponent: JComponent): ActionToolbar {
        val actionGroup = DefaultActionGroup()

        actionGroup.add(object : AnAction(
            BpmnDiffBundle.message("action.mode.branch.text"),
            BpmnDiffBundle.message("action.mode.branch.description"),
            AllIcons.Vcs.Branch
        ) {
            override fun actionPerformed(e: AnActionEvent) {
                switchMode(BRANCH_MODE)
            }

            override fun update(e: AnActionEvent) {
                e.presentation.isEnabled = !isBranchModeActive()
            }

            override fun getActionUpdateThread() = ActionUpdateThread.EDT
        })

        actionGroup.add(object : AnAction(
            BpmnDiffBundle.message("action.mode.commit.text"),
            BpmnDiffBundle.message("action.mode.commit.description"),
            AllIcons.Vcs.CommitNode
        ) {
            override fun actionPerformed(e: AnActionEvent) {
                switchMode(COMMIT_MODE)
            }

            override fun update(e: AnActionEvent) {
                e.presentation.isEnabled = !isCommitModeActive()
            }

            override fun getActionUpdateThread() = ActionUpdateThread.EDT
        })

        actionGroup.add(object : AnAction(
            BpmnDiffBundle.message("action.mode.manual.text"),
            BpmnDiffBundle.message("action.mode.manual.description"),
            AllIcons.Diff.ApplyNotConflicts
        ) {
            override fun actionPerformed(e: AnActionEvent) {
                switchMode(MANUAL_MODE)
            }

            override fun update(e: AnActionEvent) {
                e.presentation.isEnabled = !isManualModeActive()
            }

            override fun getActionUpdateThread() = ActionUpdateThread.EDT
        })

        actionGroup.addSeparator()

        val actionManager = ActionManager.getInstance()
        actionGroup.add(BranchComboBoxAction(true))
        actionManager.getAction("BpmnDiff.ShowDiff")?.let { actionGroup.add(it) }
        actionGroup.add(BranchComboBoxAction(false))

        actionGroup.add(CommitComboBoxAction(true))
        actionGroup.add(CommitComboBoxAction(false))

        actionGroup.addSeparator()

        actionGroup.add(FileComboBoxAction())

        actionManager.getAction("BpmnDiff.PreviousFile")?.let { actionGroup.add(it) }
        actionManager.getAction("BpmnDiff.NextFile")?.let { actionGroup.add(it) }
        actionGroup.add(BpmnDiffOpenInAssociatedApplicationAction())

        actionGroup.add(ManualFileSelectAction(true))
        actionGroup.add(ManualFileSelectAction(false))

        actionGroup.addSeparator()

        actionManager.getAction("BpmnDiff.Refresh")?.let { actionGroup.add(it) }

        val toolbar = ActionManager.getInstance().createActionToolbar("BpmnDiffToolbar", actionGroup, true)
        toolbar.targetComponent = targetComponent
        return toolbar
    }

    inner class BranchComboBoxAction(val isLeft: Boolean) : ComboBoxAction() {
        override fun createPopupActionGroup(button: JComponent, dataContext: DataContext): DefaultActionGroup {
            val group = DefaultActionGroup()
            for (branch in branches) {
                group.add(object : DumbAwareAction(branch) {
                    override fun actionPerformed(e: AnActionEvent) {
                        if (isLeft) selectedLeftBranch = branch else selectedRightBranch = branch
                        updateFiles()
                    }
                })
            }
            return group
        }

        override fun update(e: AnActionEvent) {
            e.presentation.isVisible = isBranchModeActive()
            e.presentation.icon = AllIcons.Vcs.Branch
            val branch = if (isLeft) selectedLeftBranch else selectedRightBranch
            e.presentation.text = branch ?: BpmnDiffBundle.message(
                if (isLeft) "action.branch.select.left.text" else "action.branch.select.right.text"
            )
        }

        override fun getActionUpdateThread() = ActionUpdateThread.EDT
    }

    inner class CommitComboBoxAction(val isLeft: Boolean) : ComboBoxAction() {
        override fun createPopupActionGroup(button: JComponent, dataContext: DataContext): DefaultActionGroup {
            val group = DefaultActionGroup()
            for ((hash, message) in commits) {
                val label = if (message.isNotBlank()) "$message | $hash" else hash
                group.add(object : DumbAwareAction(label) {
                    override fun actionPerformed(e: AnActionEvent) {
                        if (isLeft) selectedLeftCommit = hash else selectedRightCommit = hash
                        updateFiles()
                    }
                })
            }
            return group
        }

        override fun update(e: AnActionEvent) {
            e.presentation.isVisible = isCommitModeActive()
            e.presentation.icon = AllIcons.Vcs.CommitNode
            val ref = if (isLeft) selectedLeftCommit else selectedRightCommit
            e.presentation.text = ref ?: BpmnDiffBundle.message(
                if (isLeft) "action.commit.select.left.text" else "action.commit.select.right.text"
            )
        }

        override fun getActionUpdateThread() = ActionUpdateThread.EDT
    }

    inner class FileComboBoxAction : ComboBoxAction() {
        override fun createPopupActionGroup(button: JComponent, dataContext: DataContext): DefaultActionGroup {
            val group = DefaultActionGroup()
            for (file in files) {
                group.add(object : DumbAwareAction(file) {
                    override fun actionPerformed(e: AnActionEvent) {
                        selectedFile = file
                        updateCurrentFile()
                        updateWeb()
                    }
                })
            }
            return group
        }

        override fun update(e: AnActionEvent) {
            e.presentation.isVisible = isGitModeActive()
            e.presentation.icon = AllIcons.Actions.ListFiles
            val fullText = selectedFile ?: BpmnDiffBundle.message("action.file.select.text")
            val folded = StringUtil.shortenPathWithEllipsis(fullText, 64)
            e.presentation.text = folded
            e.presentation.description = fullText
            e.presentation.isEnabled = files.isNotEmpty()
        }

        override fun createCustomComponent(presentation: Presentation, place: String): JComponent {
            val component = super.createCustomComponent(presentation, place)
            val fixedWidth = JBUI.scale(400)
            val fixedSize = Dimension(fixedWidth, component.preferredSize.height)
            component.minimumSize = fixedSize
            component.preferredSize = fixedSize
            component.maximumSize = fixedSize
            return component
        }

        override fun getActionUpdateThread() = ActionUpdateThread.EDT
    }

    inner class ManualFileSelectAction(
        private val isLeft: Boolean
    ) : AnAction() {
        override fun actionPerformed(e: AnActionEvent) {
            val descriptor = FileChooserDescriptor(true, false, false, false, false, false)
                .withFileFilter { it.extension == "bpmn" || it.extension == "xml" }

            FileChooser.chooseFile(descriptor, project, null) { file ->
                val content = file.contentsToByteArray()
                val base64Content = Base64.getEncoder().encodeToString(content)
                val fileName = file.name

                if (isLeft) manualLeftFileName = fileName else manualRightFileName = fileName

                val side = if (isLeft) "left" else "right"
                val script =
                    "if (window.setManualSelection) { window.setManualSelection('$side', '$base64Content', '$fileName'); }"
                browser.cefBrowser.executeJavaScript(script, browser.cefBrowser.url, 0)
                toolbar?.updateActionsAsync()
            }
        }

        override fun update(e: AnActionEvent) {
            e.presentation.isVisible = isManualModeActive()
            val fileName = if (isLeft) manualLeftFileName else manualRightFileName
            e.presentation.text = if (fileName != null) {
                if (isLeft) "Left: $fileName" else "Right: $fileName"
            } else {
                BpmnDiffBundle.message(
                    if (isLeft) "action.manual.select.left.text" else "action.manual.select.right.text"
                )
            }
            e.presentation.icon = AllIcons.Actions.MenuOpen
        }

        override fun getActionUpdateThread() = ActionUpdateThread.EDT
    }

    fun reload() {
        if (isBranchModeActive()) {
            fetchBranches()
        } else if (isCommitModeActive()) {
            fetchCommits()
        }
        browser.cefBrowser.reload()
    }

    fun switchMode(newMode: String) {
        mode = newMode
        val script = "if (window.switchModeFromIJ) { window.switchModeFromIJ('$newMode'); }"
        browser.cefBrowser.executeJavaScript(script, browser.cefBrowser.url, 0)
        when (newMode) {
            BRANCH_MODE -> fetchBranches()
            COMMIT_MODE -> fetchCommits()
        }
        toolbar?.updateActionsAsync()
    }

    fun selectNextFile() {
        if (!isGitModeActive() || files.isEmpty()) return
        val currentIndex = files.indexOf(selectedFile)
        val nextIndex = if (currentIndex == -1 || currentIndex == files.size - 1) 0 else currentIndex + 1
        selectedFile = files[nextIndex]
        updateCurrentFile()
        updateWeb()
        toolbar?.updateActionsAsync()
    }

    fun selectPreviousFile() {
        if (!isGitModeActive() || files.isEmpty()) return
        val currentIndex = files.indexOf(selectedFile)
        val prevIndex = if (currentIndex <= 0) files.size - 1 else currentIndex - 1
        selectedFile = files[prevIndex]
        updateCurrentFile()
        updateWeb()
        toolbar?.updateActionsAsync()
    }

    fun canNavigateFiles(): Boolean = isGitModeActive() && files.size > 1

    fun isBranchModeActive(): Boolean = mode == BRANCH_MODE

    fun isCommitModeActive(): Boolean = mode == COMMIT_MODE

    fun isGitModeActive(): Boolean = isBranchModeActive() || isCommitModeActive()

    fun isManualModeActive(): Boolean = mode == MANUAL_MODE

    fun isShowDiffSelected(): Boolean = showDiff

    fun setShowDiff(show: Boolean) {
        showDiff = show
        val script = "if (window.setShowDiff) { window.setShowDiff($show); }"
        browser.cefBrowser.executeJavaScript(script, browser.cefBrowser.url, 0)
    }
}
