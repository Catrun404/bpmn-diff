package com.catrun404.bpmndiff.toolWindow

import com.catrun404.bpmndiff.BpmnDiffBundle
import com.catrun404.bpmndiff.settings.BpmnDiffConfigurable
import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import javax.swing.JComponent

class BpmnDiffToolWindowFactory : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        addNewTab(project, toolWindow)
        setupTitleActions(toolWindow)
    }

    private fun addNewTab(project: Project, toolWindow: ToolWindow) {
        var contentPanel: JComponent? = null
        val bpmnDiffToolWindow = BpmnDiffToolWindow(project) { newTitle ->
            val content = toolWindow.contentManager.contents.find { it.component == contentPanel }
            if (content != null) {
                content.displayName = newTitle
            }
        }
        contentPanel = bpmnDiffToolWindow.getContent()
        val content = ContentFactory.getInstance().createContent(
            contentPanel,
            "BPMN-Diff",
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
                    BpmnDiffBundle.message("action.settings.text"),
                    BpmnDiffBundle.message("action.settings.description"),
                    AllIcons.General.GearPlain
                ) {
                    override fun actionPerformed(e: AnActionEvent) {
                        val project = e.project ?: return
                        ShowSettingsUtil.getInstance().showSettingsDialog(project, BpmnDiffConfigurable::class.java)
                    }
                }
            ))
    }

    override fun shouldBeAvailable(project: Project) = true

}
