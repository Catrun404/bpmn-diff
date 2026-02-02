package com.catrun404.bpmndiff.actions

import com.catrun404.bpmndiff.BpmnDiffBundle
import com.catrun404.bpmndiff.toolWindow.BpmnDiffToolWindow
import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.ToggleAction
import com.intellij.openapi.project.DumbAware

class BpmnDiffToggleDiffAction : ToggleAction(
    BpmnDiffBundle.messagePointer("action.show.diff.text"),
    BpmnDiffBundle.messagePointer("action.show.diff.description"),
    AllIcons.Actions.Diff
), DumbAware {

    override fun isSelected(e: AnActionEvent): Boolean {
        val toolWindow = e.getData(BpmnDiffToolWindow.DATA_KEY)
        return toolWindow?.isShowDiffSelected() ?: true
    }

    override fun setSelected(e: AnActionEvent, state: Boolean) {
        val toolWindow = e.getData(BpmnDiffToolWindow.DATA_KEY)
        toolWindow?.setShowDiff(state)
    }

    override fun update(e: AnActionEvent) {
        super.update(e)
        val toolWindow = e.getData(BpmnDiffToolWindow.DATA_KEY)
        e.presentation.isVisible = toolWindow != null
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.EDT
}
