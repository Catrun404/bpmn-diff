package com.catrun404.bpmndiff.toolWindow

import com.catrun404.bpmndiff.BpmnDiffBundle
import com.catrun404.bpmndiff.settings.BpmnDiffSettingsState
import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Key
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import git4idea.commands.Git
import git4idea.commands.GitCommand
import git4idea.commands.GitLineHandler
import git4idea.repo.GitRepository
import git4idea.repo.GitRepositoryManager
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefCallback
import org.cef.handler.CefLoadHandlerAdapter
import org.cef.handler.CefResourceHandlerAdapter
import org.cef.misc.IntRef
import org.cef.misc.StringRef
import org.cef.network.CefRequest
import org.cef.network.CefResponse
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.URLConnection
import javax.swing.JComponent

class BpmnDiffToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        addNewTab(project, toolWindow)
        setupTitleActions(toolWindow)
    }

    private fun addNewTab(project: Project, toolWindow: ToolWindow) {
        var browserComponent: JComponent? = null
        val bpmnDiffToolWindow = BpmnDiffToolWindow(project) { newTitle ->
            val content = toolWindow.contentManager.contents.find { it.component == browserComponent }
            if (content != null) {
                content.displayName = newTitle
            }
        }
        browserComponent = bpmnDiffToolWindow.getContent()
        val content = ContentFactory.getInstance().createContent(
            browserComponent,
            "bpmn-diff",
            false
        )
        content.putUserData(BpmnDiffToolWindow.KEY, bpmnDiffToolWindow)
        toolWindow.contentManager.addContent(content)
        toolWindow.contentManager.setSelectedContent(content)
    }

    private fun setupTitleActions(toolWindow: ToolWindow) {
        toolWindow.setTitleActions(
            listOf(
                object : AnAction(
                    BpmnDiffBundle.message("action.add.tab.text"),
                    BpmnDiffBundle.message("action.add.tab.description"),
                    AllIcons.General.Add
                ) {
                    override fun actionPerformed(e: AnActionEvent) {
                        val project = e.project ?: return
                        addNewTab(project, toolWindow)
                    }
                },
                object : AnAction(
                    BpmnDiffBundle.message("action.reload.text"),
                    BpmnDiffBundle.message("action.reload.description"),
                    AllIcons.Actions.Refresh
                ) {
                    override fun actionPerformed(e: AnActionEvent) {
                        val selectedContent = toolWindow.contentManager.selectedContent
                        val bpmnDiffToolWindow =
                            selectedContent?.getUserData<BpmnDiffToolWindow>(BpmnDiffToolWindow.KEY)
                        bpmnDiffToolWindow?.reload()
                    }
                }
            ))
    }

    override fun shouldBeAvailable(project: Project) = true

}

private const val SCHEME = "https"

private const val SERVICE_DOMAIN = "bpmndiff"

private const val BPMN_DIFF_SERVICE_URL = "$SCHEME://$SERVICE_DOMAIN/"

private const val BPMN_DIFF_SERVICE_PAGE_URL = BPMN_DIFF_SERVICE_URL + "index.html"

class BpmnDiffToolWindow(private val project: Project, private val onTitleChange: (String) -> Unit) {
    private val browser = JBCefBrowser()
    private val jsQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)

    companion object {
        val KEY = Key.create<BpmnDiffToolWindow>("BpmnDiffToolWindow")
    }

    init {
        setupResourceHandler()
        jsQuery.addHandler { text ->
            onTitleChange(text)
            null
        }
        browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(browser: CefBrowser?, frame: CefFrame?, httpStatusCode: Int) {
                if (frame?.isMain == true) {
                    val script = "window.setTabTitle = function(title) { ${jsQuery.inject("title")} };"
                    browser?.executeJavaScript(script, browser.url, 0)
                }
            }
        }, browser.cefBrowser)
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
        return browser.component
    }

    fun reload() {
        browser.cefBrowser.reload()
    }
}

private const val APPLICATION_JSON_TYPE = "application/json"

private const val TEXT_PLAIN_TYPE = "text/plain"

private const val GIT_NAME_ONLY_FLAG = "--name-only"

class BpmnDiffResourceHandler(private val project: Project) : CefResourceHandlerAdapter() {
    private var inputStream: InputStream? = null
    private var mimeType: String? = null
    private var currentUrl: String = ""

    override fun processRequest(request: CefRequest, callback: CefCallback): Boolean {
        currentUrl = request.url
        val path = currentUrl.removePrefix(BPMN_DIFF_SERVICE_URL)

        if (path.startsWith("api/")) {
            val repositoryManager = GitRepositoryManager.getInstance(project)
            val repository = repositoryManager.repositories.firstOrNull()
            if (repository == null) {
                inputStream = ByteArrayInputStream("{\"error\": \"No git repository found\"}".toByteArray())
                mimeType = APPLICATION_JSON_TYPE
                callback.Continue()
                return false
            }
            handleApiRequest(path, callback, repository)
            return true
        }

        val resourcePath = "/www/$path"
        val stream = javaClass.getResourceAsStream(resourcePath)
        if (stream != null) {
            inputStream = stream
            mimeType = URLConnection.guessContentTypeFromName(path) ?: when {
                path.endsWith(".js") -> "application/javascript"
                path.endsWith(".css") -> "text/css"
                path.endsWith(".bpmn") -> "application/xml"
                else -> TEXT_PLAIN_TYPE
            }
            callback.Continue()
            return true
        }
        return false
    }

    private fun handleApiRequest(path: String, callback: CefCallback, repository: GitRepository) {
        fun decodeQueryParameters(query: String): Map<String, String> = query.split("&").associate {
            val parts = it.split("=")
            val key = parts.getOrNull(0) ?: ""
            val value = parts.getOrNull(1) ?: ""
            key to value
        }

        fun setResponse(content: String, contentType: String = APPLICATION_JSON_TYPE) {
            inputStream = ByteArrayInputStream(content.toByteArray())
            mimeType = contentType
        }

        when {
            path == "api/settings" -> {
                val settings = BpmnDiffSettingsState.getInstance(project).state
                val json = "{\"defaultOldBranch\": \"${settings.defaultOldBranch}\"}"
                setResponse(json)
            }

            path == "api/branches" -> {
                val handler = GitLineHandler(project, repository.root, GitCommand.BRANCH)
                handler.addParameters("--format=%(refname:short)|%(HEAD)")
                val result = Git.getInstance().runCommand(handler)
                if (result.success()) {
                    val branches = result.output.filter { it.isNotBlank() }.map { line ->
                        val parts = line.split("|")
                        val name = parts[0]
                        val isCurrent = parts.getOrNull(1) == "*"
                        "{\"name\":\"$name\",\"current\":$isCurrent}"
                    }
                    val json = "[" + branches.joinToString(",") + "]"
                    setResponse(json)
                } else {
                    setResponse("{\"error\": \"Failed to list branches\"}")
                }
            }

            path.startsWith("api/files") -> {
                val query = currentUrl.substringAfter("?", "")
                val params = decodeQueryParameters(query)
                val oldRef = params["oldRef"]
                val newRef = params["newRef"]

                val handler = buildFilesDiffHandler(oldRef, newRef, repository)

                val result = Git.getInstance().runCommand(handler)
                if (result.success()) {
                    val files = result.output.filter { it.endsWith(".bpmn") }.distinct()
                    val json = "[" + files.joinToString(",") { "\"$it\"" } + "]"
                    setResponse(json)
                } else {
                    setResponse("{\"error\": \"Failed to list files\"}")
                }
            }

            path.startsWith("api/content") -> {
                val query = currentUrl.substringAfter("?", "")
                val params = decodeQueryParameters(query)
                val ref = params["ref"] ?: "HEAD"
                val filePath = params["path"] ?: ""

                val handler = GitLineHandler(project, repository.root, GitCommand.SHOW)
                handler.addParameters("$ref:$filePath")
                val result = Git.getInstance().runCommand(handler)
                if (result.success()) {
                    setResponse(result.outputAsJoinedString, TEXT_PLAIN_TYPE)
                } else {
                    setResponse("", TEXT_PLAIN_TYPE)
                }
            }
        }
        callback.Continue()
    }

    private fun buildFilesDiffHandler(
        oldRef: String?,
        newRef: String?,
        repository: GitRepository
    ): GitLineHandler = if (!oldRef.isNullOrBlank() && !newRef.isNullOrBlank()) {
        if (oldRef == newRef) {
            val h = GitLineHandler(project, repository.root, GitCommand.LS_TREE)
            h.addParameters("-r", newRef, GIT_NAME_ONLY_FLAG)
            h
        } else {
            val h = GitLineHandler(project, repository.root, GitCommand.DIFF)
            h.addParameters(GIT_NAME_ONLY_FLAG, oldRef, newRef)
            h
        }
    } else {
        val h = GitLineHandler(project, repository.root, GitCommand.LS_TREE)
        h.addParameters("-r", "HEAD", GIT_NAME_ONLY_FLAG)
        h
    }

    override fun getResponseHeaders(response: CefResponse, responseLength: IntRef, redirectUrl: StringRef) {
        response.mimeType = mimeType
        response.status = 200
    }

    override fun readResponse(dataOut: ByteArray, bytesToRead: Int, bytesRead: IntRef, callback: CefCallback): Boolean {
        val available = inputStream?.available() ?: 0
        if (available <= 0) {
            inputStream?.close()
            return false
        }
        val read = inputStream?.read(dataOut, 0, available.coerceAtMost(bytesToRead)) ?: 0
        bytesRead.set(read)
        return true
    }
}
