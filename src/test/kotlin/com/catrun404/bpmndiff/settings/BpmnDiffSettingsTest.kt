package com.catrun404.bpmndiff.settings

import com.intellij.testFramework.fixtures.BasePlatformTestCase

class BpmnDiffSettingsTest : BasePlatformTestCase() {

    fun testDefaultLeftBranch() {
        val settings = BpmnDiffSettingsState.getInstance(project).state
        assertEquals("dev", settings.defaultLeftBranch)
    }

    fun testChangeLeftBranch() {
        val settings = BpmnDiffSettingsState.getInstance(project).state
        settings.defaultLeftBranch = "feature-x"
        
        val updatedSettings = BpmnDiffSettingsState.getInstance(project).state
        assertEquals("feature-x", updatedSettings.defaultLeftBranch)
        
        // Reset for other tests
        settings.defaultLeftBranch = "dev"
    }
}
