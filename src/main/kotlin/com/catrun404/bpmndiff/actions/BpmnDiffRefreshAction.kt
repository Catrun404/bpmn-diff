package com.catrun404.bpmndiff.actions

import com.catrun404.bpmndiff.BpmnDiffBundle
import com.catrun404.bpmndiff.toolWindow.BpmnDiffToolWindow
import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.DumbAwareAction

class BpmnDiffRefreshAction : DumbAwareAction(
    BpmnDiffBundle.message("action.refresh.text"),
    BpmnDiffBundle.message("action.refresh.description"),
    AllIcons.Actions.Refresh
) {
    override fun actionPerformed(e: AnActionEvent) {
        e.getData(BpmnDiffToolWindow.DATA_KEY)?.reload()
    }

}
