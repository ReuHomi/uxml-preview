// Dumps the laid-out geometry of UXML cases to JSON, for comparison against
// uxml-preview's own layout.
//
// Setup
//   1. Put this file under Assets/Editor/ in any Unity project.
//   2. In the repo run `pnpm golden:emit`, which writes tests/golden/cases/.
//      Copy that folder into the project, e.g. Assets/GoldenCases/.
//   3. Unity: Tools > uxml-preview > Golden Case Dumper
//   4. Browse to the case folder, press Run, pick an output folder.
//   5. Copy the resulting *.json into tests/golden/unity/ in the repo.
//   6. `pnpm test:golden`
//
// Why geometry and not a screenshot: Unity draws text with its own font asset
// and a browser does not, so a pixel diff over any case containing text
// measures the font rather than the layout. Numbers say where the boxes went.
//
// The panel size is written into every file, and the web side lays the case out
// at exactly that size, so nobody has to keep two numbers in sync.

#if UNITY_EDITOR
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
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

        // Frames to let a case lay out before its numbers are read. Layout runs
        // on the panel's own schedule, not when CloneTree returns.
        private const long SettleMs = 120;

        private string _caseFolder = "Assets/GoldenCases";
        private string _outputFolder = "";
        private VisualElement _stage;
        private Label _status;
        private readonly List<string> _log = new List<string>();

        [MenuItem("Tools/uxml-preview/Golden Case Dumper")]
        private static void Open()
        {
            GetWindow<UxmlLayoutDumpWindow>("Golden Dump").minSize = new Vector2(560, 260);
        }

        private void CreateGUI()
        {
            var root = rootVisualElement;
            root.style.paddingLeft = 8;
            root.style.paddingTop = 8;
            root.style.paddingRight = 8;

            var pathField = new TextField("Case folder") { value = _caseFolder };
            pathField.RegisterValueChangedCallback(e =>
            {
                _caseFolder = e.newValue;
                Refresh();
            });
            root.Add(pathField);

            var browse = new Button(() =>
            {
                string picked = EditorUtility.OpenFolderPanel("Folder holding the .uxml cases",
                    Application.dataPath, "");
                if (string.IsNullOrEmpty(picked)) return;
                _caseFolder = ToProjectRelative(picked);
                pathField.SetValueWithoutNotify(_caseFolder);
                Refresh();
            })
            { text = "Browse..." };
            root.Add(browse);

            _status = new Label();
            _status.style.whiteSpace = WhiteSpace.Normal;
            _status.style.marginTop = 6;
            _status.style.marginBottom = 6;
            root.Add(_status);

            root.Add(new Button(Run) { text = "Run" });

            // The cases are laid out inside this. Fixed size and taken out of
            // the window's own flow, so nothing about the window affects them.
            _stage = new VisualElement();
            _stage.style.position = Position.Absolute;
            _stage.style.left = 0;
            _stage.style.top = 4000; // parked offscreen; only its numbers matter
            _stage.style.width = PanelWidth;
            _stage.style.height = PanelHeight;
            root.Add(_stage);

            Refresh();
        }

        /// Absolute path to a path relative to the project root, when possible.
        private static string ToProjectRelative(string absolute)
        {
            string full = Path.GetFullPath(absolute).Replace('\\', '/');
            string assets = Path.GetFullPath(Application.dataPath).Replace('\\', '/');
            if (full == assets) return "Assets";
            if (full.StartsWith(assets + "/")) return "Assets" + full.Substring(assets.Length);
            return full; // outside the project: absolute still works for reading
        }

        private string[] FindCases()
        {
            if (string.IsNullOrWhiteSpace(_caseFolder) || !Directory.Exists(_caseFolder))
            {
                return new string[0];
            }
            // Recursive, so a folder copied one level deeper than expected still
            // works rather than reporting nothing found.
            return Directory.GetFiles(_caseFolder, "*.uxml", SearchOption.AllDirectories)
                .OrderBy(p => p, System.StringComparer.Ordinal)
                .ToArray();
        }

        private void Refresh()
        {
            if (_status == null) return;
            string resolved = string.IsNullOrWhiteSpace(_caseFolder)
                ? "(empty)"
                : Path.GetFullPath(_caseFolder).Replace('\\', '/');

            string[] found = FindCases();
            _status.text =
                $"Looking in: {resolved}\n" +
                $"Exists: {Directory.Exists(_caseFolder)}   .uxml found: {found.Length}\n" +
                $"Working directory: {Path.GetFullPath(".").Replace('\\', '/')}";
        }

        private void Run()
        {
            Refresh();
            string[] files = FindCases();

            if (files.Length == 0)
            {
                // Say exactly which path was checked. "No .uxml files" on its own
                // leaves nothing to act on.
                EditorUtility.DisplayDialog(
                    "Golden Dump",
                    $"No .uxml files found.\n\n" +
                    $"Looked in:\n{Path.GetFullPath(_caseFolder).Replace('\\', '/')}\n\n" +
                    $"Folder exists: {Directory.Exists(_caseFolder)}\n" +
                    $"Working directory:\n{Path.GetFullPath(".").Replace('\\', '/')}\n\n" +
                    "Use Browse... to point at the folder holding the .uxml files.",
                    "OK");
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
                Debug.Log("[uxml-preview] golden dump\n" + string.Join("\n", _log));
                EditorUtility.RevealInFinder(_outputFolder);
                _status.text = $"Done. {_log.Count} cases written to {_outputFolder}";
                return;
            }

            string path = remaining.Dequeue().Replace('\\', '/');
            string name = Path.GetFileNameWithoutExtension(path);
            string assetPath = ToProjectRelative(path);

            var tree = AssetDatabase.LoadAssetAtPath<VisualTreeAsset>(assetPath);
            if (tree == null)
            {
                _log.Add($"{name}: SKIPPED, could not load as VisualTreeAsset ({assetPath})");
                ProcessNext(remaining);
                return;
            }

            _stage.Clear();
            _stage.styleSheets.Clear();

            string ussPath = Path.ChangeExtension(assetPath, ".uss");
            var sheet = AssetDatabase.LoadAssetAtPath<StyleSheet>(ussPath);
            if (sheet != null) _stage.styleSheets.Add(sheet);

            tree.CloneTree(_stage);
            _status.text = $"Laying out {name} ({remaining.Count} left)...";

            // Sequencing runs off the scheduler, not GeometryChangedEvent. The
            // stage is a fixed 400x300 and never changes size, so that event
            // fires for the first case and never again -- which stalls the queue
            // silently at case two.
            _stage.schedule.Execute(() =>
            {
                Write(name);
                ProcessNext(remaining);
            }).ExecuteLater(SettleMs);

            Repaint();
        }

        private void Write(string name)
        {
            var entries = new List<string>();
            var seen = new List<string>();
            Collect(_stage, _stage.worldBound, entries, seen);

            if (entries.Count == 0)
            {
                _log.Add($"{name}: WARNING, no named elements found");
            }

            // Names are the join key on both sides, and the file is a JSON
            // object, so a repeat silently overwrites: JSON.parse keeps the last
            // and the comparison never learns the other one existed. This became
            // reachable the moment controls with implicit children were dumped --
            // two ScrollViews in one case means two `unity-content-container`s.
            var duplicates = new List<string>();
            for (int i = 0; i < seen.Count; i++)
            {
                if (seen.IndexOf(seen[i]) != i && !duplicates.Contains(seen[i]))
                {
                    duplicates.Add(seen[i]);
                }
            }
            if (duplicates.Count > 0)
            {
                _log.Add($"{name}: DUPLICATE NAMES, only the last of each is written -- " +
                    string.Join(", ", duplicates) +
                    ". Give each element a unique name, or split the case.");
            }

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

        /// Walks the real visual tree, not the UXML.
        ///
        /// That distinction is the whole value of this dump for controls that
        /// build children of their own. A ScrollView written as one tag becomes
        /// a ScrollView, a `unity-content-viewport` and a `unity-content-container`
        /// in the tree, and because Unity names those parts they land here
        /// automatically. The hierarchy is therefore observed, never guessed --
        /// which matters, because it is the hierarchy that decides where every
        /// child of a scroll region ends up.
        private static void Collect(VisualElement element, Rect origin, List<string> into,
            List<string> seen)
        {
            foreach (VisualElement child in element.Children())
            {
                // Only named elements are comparable: `name` is the key the web
                // side joins on. Unnamed elements are walked through, not dumped.
                if (!string.IsNullOrEmpty(child.name))
                {
                    seen.Add(child.name);
                    Rect w = child.worldBound;
                    into.Add(string.Format(CultureInfo.InvariantCulture,
                        "    \"{0}\": {{ \"x\": {1}, \"y\": {2}, \"width\": {3}, \"height\": {4} }}",
                        child.name, R(w.x - origin.x), R(w.y - origin.y), R(w.width), R(w.height)));
                }
                Collect(child, origin, into, seen);
            }
        }

        private static string R(float value)
        {
            return (Mathf.Round(value * 10f) / 10f).ToString("0.###", CultureInfo.InvariantCulture);
        }
    }
}
#endif
