package com.catrun404.bpmndiff.toolWindow

object BpmnDiffConstants {
    const val SCHEME = "https"
    const val SERVICE_DOMAIN = "bpmndiff"
    const val BPMN_DIFF_SERVICE_URL = "$SCHEME://$SERVICE_DOMAIN/"
    const val BPMN_DIFF_SERVICE_PAGE_URL = BPMN_DIFF_SERVICE_URL + "index.html"

    const val MANUAL_MODE = "manual"
    const val GIT_MODE = "git"

    const val APPLICATION_JSON_TYPE = "application/json"
    const val TEXT_PLAIN_TYPE = "text/plain"
}
