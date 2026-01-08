package com.catrun404.bpmndiff.settings

import com.intellij.testFramework.fixtures.BasePlatformTestCase

class BpmnDiffSettingsTest : BasePlatformTestCase() {

    fun testDefaultOldBranch() {
        val settings = BpmnDiffSettingsState.getInstance(project).state
        assertEquals("dev", settings.defaultOldBranch)
    }

    fun testChangeOldBranch() {
        val settings = BpmnDiffSettingsState.getInstance(project).state
        settings.defaultOldBranch = "feature-x"
        
        val updatedSettings = BpmnDiffSettingsState.getInstance(project).state
        assertEquals("feature-x", updatedSettings.defaultOldBranch)
        
        // Reset for other tests
        settings.defaultOldBranch = "dev"
    }
}
