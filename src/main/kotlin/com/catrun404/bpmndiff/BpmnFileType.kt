package com.catrun404.bpmndiff

import com.intellij.icons.AllIcons
import com.intellij.lang.Language
import com.intellij.openapi.fileTypes.LanguageFileType
import javax.swing.Icon

object BpmnFileType : LanguageFileType(Language.findLanguageByID("XML") ?: Language.ANY) {

    override fun getName(): String = "BPMN"

    override fun getDescription(): String = "BPMN 2.0 Process definition"

    override fun getDefaultExtension(): String = "bpmn"

    override fun getIcon(): Icon = AllIcons.FileTypes.Xml

}
