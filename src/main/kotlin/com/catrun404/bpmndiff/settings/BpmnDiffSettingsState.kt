package com.catrun404.bpmndiff.settings

import com.intellij.openapi.components.*
import com.intellij.openapi.project.Project

@Service(Service.Level.PROJECT)
@State(
    name = "com.catrun404.bpmndiff.settings.BpmnDiffSettingsState",
    storages = [Storage("BpmnDiffSettings.xml")]
)
class BpmnDiffSettingsState : PersistentStateComponent<BpmnDiffSettingsState.State> {

    class State {
        var defaultOldBranch: String = "dev"
    }

    private var myState = State()

    override fun getState(): State = myState

    override fun loadState(state: State) {
        myState = state
    }

    companion object {
        fun getInstance(project: Project): BpmnDiffSettingsState = project.getService(BpmnDiffSettingsState::class.java)
    }
}
