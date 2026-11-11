using System;
using System.Globalization;
using UnityEditor;
using UnityEngine;
using UnityEngine.TextCore.Text;

public static class FontProbe
{
    static string Arg(string name)
    {
        var a = Environment.GetCommandLineArgs();
        for (int i = 0; i < a.Length - 1; i++) if (a[i] == name) return a[i + 1];
        throw new Exception("missing " + name);
    }

    // Step 2.3: create the font asset with the menu command.
    public static void Create()
    {
        var fontPath = Arg("-fontPath");
        var font = AssetDatabase.LoadAssetAtPath<Font>(fontPath);
        if (font == null) throw new Exception("font not loaded: " + fontPath);
        Selection.activeObject = font;
        var menu = Arg("-menu");
        bool ok = EditorApplication.ExecuteMenuItem(menu);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        Debug.Log("PROBE created via '" + menu + "' ok=" + ok);
    }

    // Steps 2.4-2.5: a fresh process loads the asset and logs faceInfo with "R".
    public static void Dump()
    {
        var path = Arg("-assetPath");
        var fa = AssetDatabase.LoadAssetAtPath<FontAsset>(path);
        if (fa == null) throw new Exception("FontAsset not loaded: " + path);
        var f = fa.faceInfo;
        var c = CultureInfo.InvariantCulture;
        Debug.Log("PROBE unity=" + Application.unityVersion + " asset=" + path +
            " pointSize=" + f.pointSize.ToString("R", c) +
            " ascentLine=" + f.ascentLine.ToString("R", c) +
            " descentLine=" + f.descentLine.ToString("R", c) +
            " lineHeight=" + f.lineHeight.ToString("R", c));
    }
}
