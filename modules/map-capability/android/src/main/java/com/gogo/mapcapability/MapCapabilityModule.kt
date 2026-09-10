package com.gogo.mapcapability

import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Reads the installed binary, never the Metro manifest. No key crosses the bridge. */
class MapCapabilityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GoGoMapCapability")
    Constants {
      val context = appContext.reactContext
      val configured = try {
        @Suppress("DEPRECATION")
        val info = context?.packageManager?.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
        !info?.metaData?.getString("com.google.android.geo.API_KEY").isNullOrBlank()
      } catch (_: Exception) { false }
      mapOf("googleMapsConfigured" to configured)
    }
  }
}
