package com.catrun404.bpmndiff.toolWindow

import com.catrun404.bpmndiff.services.BpmnDiffToolWindowService
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory

class BpmnDiffToolWindowFactory : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        project.service<BpmnDiffToolWindowService>().addNewTab(toolWindow)
        setupTitleActions(toolWindow)
    }

    private fun setupTitleActions(toolWindow: ToolWindow) {
        val actionManager = ActionManager.getInstance()
        toolWindow.setTitleActions(
            listOf(
                actionManager.getAction("BpmnDiff.AddTab"),
                actionManager.getAction("BpmnDiff.Settings")
            )
        )
    }

    override fun shouldBeAvailable(project: Project) = true
}
