package com.catrun404.bpmndiff.services

import com.catrun404.bpmndiff.toolWindow.BpmnDiffConstants
import com.catrun404.bpmndiff.toolWindow.BpmnDiffToolWindow
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.ui.content.ContentFactory
import javax.swing.JComponent

@Service(Service.Level.PROJECT)
class BpmnDiffToolWindowService(private val project: Project) {
    fun addNewTab(toolWindow: ToolWindow? = null) {
        val tw = toolWindow ?: ToolWindowManager.getInstance(project)
            .getToolWindow(BpmnDiffConstants.TOOL_WINDOW_ID) ?: return

        var contentPanel: JComponent? = null
        val bpmnDiffToolWindow = BpmnDiffToolWindow(project) { newTitle ->
            val content = tw.contentManager.contents.find { it.component == contentPanel }
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

        tw.contentManager.addContent(content)
        tw.contentManager.setSelectedContent(content)
    }
}
