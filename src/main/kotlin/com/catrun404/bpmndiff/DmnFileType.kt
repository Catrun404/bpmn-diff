package com.catrun404.bpmndiff

import com.intellij.icons.AllIcons
import com.intellij.lang.Language
import com.intellij.openapi.fileTypes.LanguageFileType
import javax.swing.Icon

object DmnFileType : LanguageFileType(Language.findLanguageByID("XML") ?: Language.ANY) {

    override fun getName(): String = "DMN"

    override fun getDisplayName(): String = "DMN"

    override fun getDescription(): String = "DMN 1.3 Decision model"

    override fun getDefaultExtension(): String = "dmn"

    override fun getIcon(): Icon = AllIcons.FileTypes.Xml

}
