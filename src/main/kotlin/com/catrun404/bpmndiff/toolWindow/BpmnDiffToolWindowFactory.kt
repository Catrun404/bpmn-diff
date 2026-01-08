package com.catrun404.bpmndiff.toolWindow

import com.catrun404.bpmndiff.settings.BpmnDiffSettingsState
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefBrowser
import git4idea.commands.Git
import git4idea.commands.GitCommand
import git4idea.commands.GitLineHandler
import git4idea.repo.GitRepository
import git4idea.repo.GitRepositoryManager
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefCallback
import org.cef.handler.CefResourceHandlerAdapter
import org.cef.misc.IntRef
import org.cef.misc.StringRef
import org.cef.network.CefRequest
import org.cef.network.CefResponse
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.URLConnection
import javax.swing.JComponent

class BpmnDiffToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val bpmnDiffToolWindow = BpmnDiffToolWindow(project)
        val content = ContentFactory.getInstance().createContent(bpmnDiffToolWindow.getContent(), "", false)
        toolWindow.contentManager.addContent(content)
    }

    override fun shouldBeAvailable(project: Project) = true

}

private const val SCHEME = "https"

private const val SERVICE_DOMAIN = "bpmndiff"

private const val BPMN_DIFF_SERVICE_URL = "$SCHEME://$SERVICE_DOMAIN/"

private const val BPMN_DIFF_SERVICE_PAGE_URL = BPMN_DIFF_SERVICE_URL + "index.html"

class BpmnDiffToolWindow(private val project: Project) {
    private val browser = JBCefBrowser()

    init {
        setupResourceHandler()
    }

    private fun setupResourceHandler() {
        val schemeHandlerFactory = { _: CefBrowser?, _: CefFrame?, _: String?, request: CefRequest? ->
            val url = request?.url ?: ""
            if (url.startsWith(BPMN_DIFF_SERVICE_URL)) {
                BpmnDiffResourceHandler(project)
            } else {
                null
            }
        }
        CefApp.getInstance()
            .registerSchemeHandlerFactory(SCHEME, SERVICE_DOMAIN, schemeHandlerFactory)
    }

    fun getContent(): JComponent {
        browser.loadURL(BPMN_DIFF_SERVICE_PAGE_URL)
        return browser.component
    }
}

private const val APPLICATION_JSON_TYPE = "application/json"

class BpmnDiffResourceHandler(private val project: Project) : CefResourceHandlerAdapter() {
    private var inputStream: InputStream? = null
    private var mimeType: String? = null
    private var currentUrl: String = ""

    override fun processRequest(request: CefRequest, callback: CefCallback): Boolean {
        currentUrl = request.url
        val path = currentUrl.removePrefix(BPMN_DIFF_SERVICE_URL)

        if (path.startsWith("api/")) {
            val repositoryManager = GitRepositoryManager.getInstance(project)
            val repository = repositoryManager.repositories.firstOrNull()
            if (repository == null) {
                inputStream = ByteArrayInputStream("{\"error\": \"No git repository found\"}".toByteArray())
                mimeType = APPLICATION_JSON_TYPE
                callback.Continue()
                return false
            }
            handleApiRequest(path, callback, repository)
            return true
        }

        val resourcePath = "/www/$path"
        val stream = javaClass.getResourceAsStream(resourcePath)
        if (stream != null) {
            inputStream = stream
            mimeType = URLConnection.guessContentTypeFromName(path) ?: when {
                path.endsWith(".js") -> "application/javascript"
                path.endsWith(".css") -> "text/css"
                path.endsWith(".bpmn") -> "application/xml"
                else -> "text/plain"
            }
            callback.Continue()
            return true
        }
        return false
    }

    private fun handleApiRequest(path: String, callback: CefCallback, repository: GitRepository) {
        fun decodeQueryParameters(query: String): Map<String, String> = query.split("&").associate {
            val parts = it.split("=")
            val key = parts.getOrNull(0) ?: ""
            val value = parts.getOrNull(1) ?: ""
            key to value
        }

        when {
            path == "api/settings" -> {
                val settings = BpmnDiffSettingsState.getInstance(project).state
                val json = "{\"defaultOldBranch\": \"${settings.defaultOldBranch}\"}"
                inputStream = ByteArrayInputStream(json.toByteArray())
                mimeType = APPLICATION_JSON_TYPE
            }

            path == "api/branches" -> {
                val handler = GitLineHandler(project, repository.root, GitCommand.BRANCH)
                handler.addParameters("--format=%(refname:short)|%(HEAD)")
                val result = Git.getInstance().runCommand(handler)
                if (result.success()) {
                    val branches = result.output.filter { it.isNotBlank() }.map { line ->
                        val parts = line.split("|")
                        val name = parts[0]
                        val isCurrent = parts.getOrNull(1) == "*"
                        "{\"name\":\"$name\",\"current\":$isCurrent}"
                    }
                    val json = "[" + branches.joinToString(",") + "]"
                    inputStream = ByteArrayInputStream(json.toByteArray())
                    mimeType = APPLICATION_JSON_TYPE
                } else {
                    inputStream = ByteArrayInputStream("{\"error\": \"Failed to list branches\"}".toByteArray())
                    mimeType = APPLICATION_JSON_TYPE
                }
            }

            path.startsWith("api/files") -> {
                val query = currentUrl.substringAfter("?", "")
                val params = decodeQueryParameters(query)
                val oldRef = params["oldRef"]
                val newRef = params["newRef"]

                val handler = if (!oldRef.isNullOrBlank() && !newRef.isNullOrBlank()) {
                    val h = GitLineHandler(project, repository.root, GitCommand.DIFF)
                    h.addParameters("--name-only", oldRef, newRef)
                    h
                } else {
                    val h = GitLineHandler(project, repository.root, GitCommand.LS_TREE)
                    h.addParameters("-r", "HEAD", "--name-only")
                    h
                }

                val result = Git.getInstance().runCommand(handler)
                if (result.success()) {
                    val files = result.output.filter { it.endsWith(".bpmn") }.distinct()
                    val json = "[" + files.joinToString(",") { "\"$it\"" } + "]"
                    inputStream = ByteArrayInputStream(json.toByteArray())
                    mimeType = APPLICATION_JSON_TYPE
                } else {
                    inputStream = ByteArrayInputStream("{\"error\": \"Failed to list files\"}".toByteArray())
                    mimeType = APPLICATION_JSON_TYPE
                }
            }

            path.startsWith("api/content") -> {
                val query = currentUrl.substringAfter("?", "")
                val params = decodeQueryParameters(query)
                val ref = params["ref"] ?: "HEAD"
                val filePath = params["path"] ?: ""

                val handler = GitLineHandler(project, repository.root, GitCommand.SHOW)
                handler.addParameters("$ref:$filePath")
                val result = Git.getInstance().runCommand(handler)
                if (result.success()) {
                    inputStream = ByteArrayInputStream(result.outputAsJoinedString.toByteArray())
                    mimeType = "text/plain"
                } else {
                    inputStream = ByteArrayInputStream("{\"error\": \"Failed to get file content\"}".toByteArray())
                    mimeType = APPLICATION_JSON_TYPE
                }
            }
        }
        callback.Continue()
    }

    override fun getResponseHeaders(response: CefResponse, responseLength: IntRef, redirectUrl: StringRef) {
        response.mimeType = mimeType
        response.status = 200
    }

    override fun readResponse(dataOut: ByteArray, bytesToRead: Int, bytesRead: IntRef, callback: CefCallback): Boolean {
        val available = inputStream?.available() ?: 0
        if (available <= 0) {
            inputStream?.close()
            return false
        }
        val read = inputStream?.read(dataOut, 0, available.coerceAtMost(bytesToRead)) ?: 0
        bytesRead.set(read)
        return true
    }
}
