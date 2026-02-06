package com.catrun404.bpmndiff.actions

import com.catrun404.bpmndiff.BpmnDiffBundle
import com.catrun404.bpmndiff.settings.BpmnDiffConfigurable
import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.DumbAwareAction

class BpmnDiffSettingsAction : DumbAwareAction(
    BpmnDiffBundle.messagePointer("action.settings.text"),
    BpmnDiffBundle.messagePointer("action.settings.description"),
    AllIcons.General.GearPlain
) {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        ShowSettingsUtil.getInstance().showSettingsDialog(project, BpmnDiffConfigurable::class.java)
    }
}
