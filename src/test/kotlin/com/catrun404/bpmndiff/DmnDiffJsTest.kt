package com.catrun404.bpmndiff

import org.junit.Assert.assertTrue
import org.junit.Test
import javax.script.Invocable
import javax.script.ScriptEngineManager

class DmnDiffJsTest {

    @Test
    fun testDmnDiff() {
        val engineManager = ScriptEngineManager()
        val engine = engineManager.getEngineByName("JavaScript") ?: engineManager.getEngineByName("Graal.js")
        if (engine == null) {
            println("[DEBUG_LOG] No JavaScript engine found, skipping JS test")
            return
        }

        val jsCode = javaClass.getResource("/docker/dmn-diff.js")!!.readText()
        // Strip 'export ' to make it a regular function for the script engine
        val runnableJs = jsCode.replace("export function", "function")
        engine.eval(runnableJs)

        val invocable = engine as Invocable

        val left = mapOf(
            "id" to "Definitions_1",
            "drgElement" to listOf(
                mapOf("id" to "Decision_1", "name" to "Decision 1", "\$type" to "dmn:Decision")
            )
        )

        val right = mapOf(
            "id" to "Definitions_1",
            "drgElement" to listOf(
                mapOf("id" to "Decision_1", "name" to "Decision 1 changed", "\$type" to "dmn:Decision"),
                mapOf("id" to "Decision_2", "name" to "Decision 2", "\$type" to "dmn:Decision")
            )
        )

        val result = invocable.invokeFunction("dmnDiff", left, right) as Map<*, *>
        
        val added = result["added"] as Map<*, *>
        val removed = result["removed"] as Map<*, *>
        val changed = result["changed"] as Map<*, *>

        // Decision_2 is added
        assertTrue(added.containsKey("Decision_2"))
        
        // Decision_1 is changed
        assertTrue(changed.containsKey("Decision_1"))
        
        // Nothing removed
        assertTrue(removed.isEmpty())
    }

    @Test
    fun testDmnDiffLayout() {
        val engineManager = ScriptEngineManager()
        val engine = engineManager.getEngineByName("JavaScript") ?: engineManager.getEngineByName("Graal.js")
        if (engine == null) return

        val jsCode = javaClass.getResource("/docker/dmn-diff.js")!!.readText()
        val runnableJs = jsCode.replace("export function", "function")
        engine.eval(runnableJs)
        val invocable = engine as Invocable

        val left = mapOf(
            "id" to "Definitions_1",
            "dmndi" to mapOf(
                "id" to "DMNDI_1",
                "diagram" to listOf(
                    mapOf(
                        "id" to "DMNDiagram_1",
                        "sharedElement" to listOf(
                            mapOf(
                                "id" to "Shape_1",
                                "\$type" to "dmndi:DMNShape",
                                "bounds" to mapOf("x" to 100, "y" to 100, "width" to 100, "height" to 80)
                            )
                        )
                    )
                )
            )
        )

        val right = mapOf(
            "id" to "Definitions_1",
            "dmndi" to mapOf(
                "id" to "DMNDI_1",
                "diagram" to listOf(
                    mapOf(
                        "id" to "DMNDiagram_1",
                        "sharedElement" to listOf(
                            mapOf(
                                "id" to "Shape_1",
                                "\$type" to "dmndi:DMNShape",
                                "bounds" to mapOf("x" to 150, "y" to 100, "width" to 100, "height" to 80)
                            )
                        )
                    )
                )
            )
        )

        val result = invocable.invokeFunction("dmnDiff", left, right) as Map<*, *>
        val changed = result["changed"] as Map<*, *>

        // Shape_1 is changed because x changed from 100 to 150
        assertTrue(changed.containsKey("Shape_1"))
    }
}
