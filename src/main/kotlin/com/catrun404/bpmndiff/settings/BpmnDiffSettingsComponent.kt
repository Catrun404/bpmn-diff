package com.catrun404.bpmndiff.settings

import com.catrun404.bpmndiff.BpmnDiffBundle
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import javax.swing.JComponent
import javax.swing.JPanel

class BpmnDiffSettingsComponent {
    val panel: JPanel
    private val defaultLeftBranchText = JBTextField()

    init {
        panel = FormBuilder.createFormBuilder()
            .addLabeledComponent(
                JBLabel(BpmnDiffBundle.message("settings.default.left.branch.label")),
                defaultLeftBranchText,
                1,
                false
            )
            .addComponentFillVertically(JPanel(), 0)
            .panel
    }

    val preferredFocusedComponent: JComponent
        get() = defaultLeftBranchText

    var defaultLeftBranch: String
        get() = defaultLeftBranchText.text
        set(newText) {
            defaultLeftBranchText.text = newText
        }
}
