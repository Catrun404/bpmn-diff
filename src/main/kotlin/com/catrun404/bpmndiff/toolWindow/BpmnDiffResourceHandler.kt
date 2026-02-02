package com.catrun404.bpmndiff.toolWindow

import com.catrun404.bpmndiff.git.BpmnDiffGitService
import com.catrun404.bpmndiff.settings.BpmnDiffSettingsState
import com.catrun404.bpmndiff.toolWindow.BpmnDiffConstants.APPLICATION_JSON_TYPE
import com.catrun404.bpmndiff.toolWindow.BpmnDiffConstants.BPMN_DIFF_SERVICE_URL
import com.catrun404.bpmndiff.toolWindow.BpmnDiffConstants.TEXT_PLAIN_TYPE
import com.intellij.openapi.project.Project
import git4idea.repo.GitRepository
import org.cef.callback.CefCallback
import org.cef.handler.CefResourceHandlerAdapter
import org.cef.misc.IntRef
import org.cef.misc.StringRef
import org.cef.network.CefRequest
import org.cef.network.CefResponse
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.URLConnection
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

class BpmnDiffResourceHandler(private val project: Project) : CefResourceHandlerAdapter() {
    private var inputStream: InputStream? = null
    private var mimeType: String? = null
    private var currentUrl: String = ""

    override fun processRequest(request: CefRequest, callback: CefCallback): Boolean {
        currentUrl = request.url
        val path = currentUrl.removePrefix(BPMN_DIFF_SERVICE_URL)

        if (path.startsWith("api/")) {
            val gitService = BpmnDiffGitService.getInstance(project)
            val repository = gitService.getFirstRepository()
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
                else -> TEXT_PLAIN_TYPE
            }
            callback.Continue()
            return true
        }
        return false
    }

    private fun handleApiRequest(path: String, callback: CefCallback, repository: GitRepository) {
        fun decodeQueryParameters(query: String): Map<String, String> = query.split("&").associate {
            val parts = it.split("=")
            val key = parts.getOrNull(0)?.let { k -> URLDecoder.decode(k, StandardCharsets.UTF_8) } ?: ""
            val value = parts.getOrNull(1)?.let { v -> URLDecoder.decode(v, StandardCharsets.UTF_8) } ?: ""
            key to value
        }

        fun setResponse(content: String, contentType: String = APPLICATION_JSON_TYPE) {
            inputStream = ByteArrayInputStream(content.toByteArray())
            mimeType = contentType
        }

        when {
            path == "api/settings" -> {
                val settings = BpmnDiffSettingsState.getInstance(project).state
                val json = "{\"defaultLeftBranch\": \"${settings.defaultLeftBranch}\"}"
                setResponse(json)
            }

            path.startsWith("api/content") -> {
                val query = currentUrl.substringAfter("?", "")
                val params = decodeQueryParameters(query)
                val ref = params["ref"] ?: "HEAD"
                val filePath = params["path"] ?: ""

                val gitService = BpmnDiffGitService.getInstance(project)
                val content = gitService.getFileContent(repository, ref, filePath)
                setResponse(content ?: "", TEXT_PLAIN_TYPE)
            }
        }
        callback.Continue()
    }

    override fun getResponseHeaders(response: CefResponse, responseLength: IntRef, redirectUrl: StringRef) {
        response.mimeType = mimeType
        response.status = 200
    }

    override fun readResponse(
        dataOut: ByteArray,
        bytesToRead: Int,
        bytesRead: IntRef,
        callback: CefCallback
    ): Boolean {
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
