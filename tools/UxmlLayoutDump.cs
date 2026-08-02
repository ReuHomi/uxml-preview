// Dumps the laid-out geometry of UXML cases to JSON, for comparison against
// uxml-preview's own layout.
//
// Setup
//   1. Put this file under Assets/Editor/ in any Unity project.
//   2. In this repo run `pnpm golden:emit`, which writes tests/golden/cases/.
//      Copy that folder into the project, e.g. Assets/GoldenCases/.
//   3. Unity: Tools > uxml-preview > Golden Case Dumper
//   4. Pick the case folder, press Run, then pick an output folder.
//   5. Copy the resulting *.json into tests/golden/unity/ in this repo.
//   6. `pnpm test:golden`
//
// Why geometry and not a screenshot: Unity draws text with its own font asset
// and a browser does not, so a pixel diff over any case containing text
// measures the font rather than the layout. Numbers say where the boxes went.
//
// Layout does not run the instant an element is added; it runs on the next
// pass. Rather than poke at internals, each case waits for the
// GeometryChangedEvent that Unity raises when its box is known.
//
// The panel size is written into every file, and the web side lays the case out
// at exactly that size, so nobody has to keep two numbers in sync.

#if UNITY_EDITOR
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;

namespace UxmlPreview.Golden
{
    public sealed class UxmlLayoutDumpWindow : EditorWindow
    {
        // Keep in step with PANEL in tests/golden/cases.ts.
        private const float PanelWidth = 400f;
        private const float PanelHeight = 300f;

        private string _caseFolder = "Assets/GoldenCases";
        private string _outputFolder = "";
        private VisualElement _stage;
        private readonly List<string> _log = new List<string>();

        [MenuItem("Tools/uxml-preview/Golden Case Dumper")]
        private static void Open()
        {
            GetWindow<UxmlLayoutDumpWindow>("Golden Dump").minSize = new Vector2(520, 420);
        }

        private void CreateGUI()
        {
            var root = rootVisualElement;

            var caseField = new TextField("Case folder (in Assets)") { value = _caseFolder };
            caseField.RegisterValueChangedCallback(e => _caseFolder = e.newValue);
            root.Add(caseField);

            var run = new Button(Run) { text = "Run" };
            root.Add(run);

            // The stage is what the cases are laid out inside. Fixed size and
            // taken out of the window's own flow so nothing here influences it.
            _stage = new VisualElement();
            _stage.style.position = Position.Absolute;
            _stage.style.left = 0;
            _stage.style.top = 2000; // parked offscreen; only its numbers matter
            _stage.style.width = PanelWidth;
            _stage.style.height = PanelHeight;
            root.Add(_stage);
        }

        private void Run()
        {
            string[] files = Directory.Exists(_caseFolder)
                ? Directory.GetFiles(_caseFolder, "*.uxml", SearchOption.TopDirectoryOnly)
                : new string[0];

            if (files.Length == 0)
            {
                EditorUtility.DisplayDialog("Golden Dump", $"No .uxml files under {_caseFolder}", "OK");
                return;
            }

            _outputFolder = EditorUtility.OpenFolderPanel("Where to write the JSON", "", "");
            if (string.IsNullOrEmpty(_outputFolder)) return;

            _log.Clear();
            ProcessNext(new Queue<string>(files));
        }

        private void ProcessNext(Queue<string> remaining)
        {
            if (remaining.Count == 0)
            {
                Debug.Log("[uxml-preview] " + string.Join("\n", _log));
                EditorUtility.RevealInFinder(_outputFolder);
                return;
            }

            string path = remaining.Dequeue().Replace('\\', '/');
            string name = Path.GetFileNameWithoutExtension(path);

            var tree = AssetDatabase.LoadAssetAtPath<VisualTreeAsset>(path);
            if (tree == null)
            {
                _log.Add($"skipped (could not load): {path}");
                ProcessNext(remaining);
                return;
            }

            _stage.Clear();
            _stage.styleSheets.Clear();

            string ussPath = Path.ChangeExtension(path, ".uss");
            var sheet = AssetDatabase.LoadAssetAtPath<StyleSheet>(ussPath);
            if (sheet != null) _stage.styleSheets.Add(sheet);

            tree.CloneTree(_stage);

            // Wait for the pass that actually computes the boxes. Reading
            // straight after CloneTree yields zeroes.
            EventCallback<GeometryChangedEvent> onLaidOut = null;
            onLaidOut = _ =>
            {
                _stage.UnregisterCallback(onLaidOut);
                Write(name);
                // Let the next case start on a clean pass.
                EditorApplication.delayCall += () => ProcessNext(remaining);
            };
            _stage.RegisterCallback(onLaidOut);

            // Nudge a pass in case the geometry happens to be unchanged.
            _stage.MarkDirtyRepaint();
        }

        private void Write(string name)
        {
            var entries = new List<string>();
            Collect(_stage, _stage.worldBound, entries);

            var sb = new StringBuilder();
            sb.Append("{\n");
            sb.Append(string.Format(CultureInfo.InvariantCulture,
                "  \"panel\": {{ \"width\": {0}, \"height\": {1} }},\n", PanelWidth, PanelHeight));
            sb.Append("  \"elements\": {\n");
            sb.Append(string.Join(",\n", entries));
            sb.Append("\n  }\n}\n");

            File.WriteAllText(Path.Combine(_outputFolder, name + ".json"), sb.ToString(),
                new UTF8Encoding(false));
            _log.Add($"{name}: {entries.Count} elements");
        }

        private static void Collect(VisualElement element, Rect origin, List<string> into)
        {
            foreach (VisualElement child in element.Children())
            {
                // Only named elements are comparable: `name` is the key the web
                // side joins on. Unnamed elements are walked through, not dumped.
                if (!string.IsNullOrEmpty(child.name))
                {
                    Rect w = child.worldBound;
                    into.Add(string.Format(CultureInfo.InvariantCulture,
                        "    \"{0}\": {{ \"x\": {1}, \"y\": {2}, \"width\": {3}, \"height\": {4} }}",
                        child.name, R(w.x - origin.x), R(w.y - origin.y), R(w.width), R(w.height)));
                }
                Collect(child, origin, into);
            }
        }

        private static string R(float value)
        {
            return (Mathf.Round(value * 10f) / 10f).ToString("0.###", CultureInfo.InvariantCulture);
        }
    }
}
#endif
