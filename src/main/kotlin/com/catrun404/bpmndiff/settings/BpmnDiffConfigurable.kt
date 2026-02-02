package com.catrun404.bpmndiff.settings

import com.catrun404.bpmndiff.BpmnDiffBundle
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.project.Project
import javax.swing.JComponent

class BpmnDiffConfigurable(private val project: Project) : Configurable {
    private var mySettingsComponent: BpmnDiffSettingsComponent? = null

    override fun getDisplayName(): String = BpmnDiffBundle.message("settings.display.name")

    override fun getPreferredFocusedComponent(): JComponent? = mySettingsComponent?.preferredFocusedComponent

    override fun createComponent(): JComponent {
        mySettingsComponent = BpmnDiffSettingsComponent()
        return mySettingsComponent!!.panel
    }

    override fun isModified(): Boolean {
        val settings = BpmnDiffSettingsState.getInstance(project).state
        return mySettingsComponent?.defaultLeftBranch != settings.defaultLeftBranch
    }

    override fun apply() {
        val settings = BpmnDiffSettingsState.getInstance(project).state
        settings.defaultLeftBranch = mySettingsComponent?.defaultLeftBranch ?: "dev"
    }

    override fun reset() {
        val settings = BpmnDiffSettingsState.getInstance(project).state
        mySettingsComponent?.defaultLeftBranch = settings.defaultLeftBranch
    }

    override fun disposeUIResources() {
        mySettingsComponent = null
    }
}
