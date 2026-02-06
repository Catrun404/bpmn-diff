package com.catrun404.bpmndiff.actions

import com.catrun404.bpmndiff.BpmnDiffBundle
import com.catrun404.bpmndiff.services.BpmnDiffToolWindowService
import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.project.DumbAwareAction

class BpmnDiffAddTabAction : DumbAwareAction(
    BpmnDiffBundle.messagePointer("action.add.tab.text"),
    BpmnDiffBundle.messagePointer("action.add.tab.description"),
    AllIcons.General.Add
) {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        project.service<BpmnDiffToolWindowService>().addNewTab()
    }
}
