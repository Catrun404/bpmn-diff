package com.catrun404.bpmndiff.git

import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import git4idea.commands.Git
import git4idea.commands.GitCommand
import git4idea.commands.GitLineHandler
import git4idea.repo.GitRepository
import git4idea.repo.GitRepositoryManager

@Service(Service.Level.PROJECT)
class BpmnDiffGitService(private val project: Project) {

    companion object {
        fun getInstance(project: Project): BpmnDiffGitService = project.service()
    }

    fun getFirstRepository(): GitRepository? {
        return GitRepositoryManager.getInstance(project).repositories.firstOrNull()
    }

    fun fetchBranches(repository: GitRepository): List<Pair<String, Boolean>> {
        val handler = GitLineHandler(project, repository.root, GitCommand.BRANCH)
        handler.addParameters("--format=%(refname:short)|%(HEAD)")
        val result = Git.getInstance().runCommand(handler)
        if (result.success()) {
            return result.output.filter { it.isNotBlank() }.map { line ->
                val parts = line.split("|")
                val name = parts[0]
                val isCurrent = parts.getOrNull(1) == "*"
                name to isCurrent
            }
        }
        return emptyList()
    }

    fun getChangedBpmnFiles(repository: GitRepository, leftRef: String, rightRef: String): List<String> {
        val handler = if (leftRef == rightRef) {
            val h = GitLineHandler(project, repository.root, GitCommand.LS_TREE)
            h.addParameters("-r", rightRef, "--name-only")
            h
        } else {
            val h = GitLineHandler(project, repository.root, GitCommand.DIFF)
            h.addParameters("--name-only", leftRef, rightRef)
            h
        }
        val result = Git.getInstance().runCommand(handler)
        return if (result.success()) {
            result.output.filter { it.endsWith(".bpmn") }.distinct()
        } else {
            emptyList()
        }
    }

    fun getFileContent(repository: GitRepository, ref: String, filePath: String): String? {
        val handler = GitLineHandler(project, repository.root, GitCommand.SHOW)
        handler.addParameters("$ref:$filePath")
        val result = Git.getInstance().runCommand(handler)
        return if (result.success()) {
            result.outputAsJoinedString
        } else {
            null
        }
    }
}
