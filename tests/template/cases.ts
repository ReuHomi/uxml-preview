/**
 * Unity-facing G3 template fixtures.
 *
 * This corpus is intentionally separate from tests/golden. It supplies real
 * UXML/USS/helper-file inputs for Unity 6000.0.40f1; probe values are questions
 * to measure, never browser-side expected values.
 */

export type TemplateCaseId =
  | 'G3-1'
  | 'G3-2'
  | 'G3-3'
  | 'G3-4'
  | 'G3-5'
  | 'G3-6'
  | 'G3-7'
  | 'G3-8'
  | 'G3-9'
  | 'G3-10'
  | 'G3-11'
  | 'G3-12';

export type TemplateMeasurementId =
  | 'L1'
  | 'L2'
  | 'L3'
  | 'L4'
  | 'C1'
  | 'C2'
  | 'C3'
  | 'C4'
  | 'C5'
  | 'C6'
  | 'O1'
  | 'O2'
  | 'O3'
  | 'O4'
  | 'O5'
  | 'X1'
  | 'X2'
  | 'X3';

export type TemplateProbeId =
  | TemplateMeasurementId
  | 'accumulated-layout'
  | 'cycle'
  | 'roundtrip'
  | 'scrollview-tree';

export type TemplateProbeRead =
  | 'computed-style'
  | 'geometry'
  | 'physical-tree'
  | 'roundtrip'
  | 'warning';

export interface TemplateProbe {
  readonly id: TemplateProbeId;
  readonly question: string;
  readonly read: TemplateProbeRead;
  readonly targets: readonly string[];
  readonly properties?: readonly string[];
  readonly note: string;
}

export interface TemplateCase {
  readonly id: TemplateCaseId;
  readonly question: string;
  readonly uxml: string;
  readonly uss: string;
  readonly files?: Readonly<Record<string, string>>;
  readonly probes: readonly TemplateProbe[];
}

export const PANEL = Object.freeze({ width: 400, height: 300 });

const uxml = (body: string): string =>
  `<ui:UXML xmlns:ui="UnityEngine.UIElements">\n${body.trim()}\n</ui:UXML>\n`;

const probe = (
  id: TemplateProbeId,
  question: string,
  read: TemplateProbeRead,
  targets: readonly string[],
  note: string,
  properties?: readonly string[],
): TemplateProbe => {
  const value = { id, question, read, targets, note };
  return properties === undefined ? value : { ...value, properties };
};

const basicTemplate = uxml(`
  <ui:VisualElement name="g31-template-root" class="g31-template-root">
    <ui:Label name="g31-label" text="basic template" />
  </ui:VisualElement>
`);

const repeatedTemplate = uxml(`
  <ui:VisualElement name="g32-template-root" class="g32-template-root">
    <ui:Label name="g32-label" text="repeated template" />
  </ui:VisualElement>
`);

const inlineAndClassTemplate = uxml(`
  <ui:VisualElement name="g33-template-root" class="g33-template-root">
    <ui:Label name="g33-label" text="instance style and class" />
  </ui:VisualElement>
`);

const cascadeTemplate = uxml(`
  <ui:VisualElement name="g34-template-root" class="g34-internal-root">
    <ui:Label name="g34-internal-label" class="g34-internal-label" text="cascade target" />
  </ui:VisualElement>
`);

const inheritedTemplate = uxml(`
  <ui:VisualElement name="g35-template-root" class="g35-template-root">
    <ui:Label name="g35-inherited-label" text="inherited value" />
  </ui:VisualElement>
`);

const scopedStyleTemplate = uxml(`
  <Style src="g3-6-template.uss" />
  <ui:VisualElement name="g36-template-root" class="g36-template-root">
    <ui:Label name="g36-template-only" class="g36-template-only" text="template style" />
  </ui:VisualElement>
`);

const nestedInnerTemplate = uxml(`
  <ui:VisualElement name="g37-inner-root" class="g37-inner-root">
    <ui:Label name="g37-deep-label" text="inner default" />
  </ui:VisualElement>
`);

const nestedOuterTemplate = uxml(`
  <ui:Template name="G37Inner" src="g3-7-inner.uxml" />
  <ui:Instance template="G37Inner" name="g37-inner-instance" />
`);

const overrideTemplate = uxml(`
  <ui:VisualElement name="g38-template-root" class="g38-template-root">
    <ui:Label name="g38-label" class="g38-label" text="template default" style="color: rgb(30, 30, 30);" />
  </ui:VisualElement>
`);

const duplicateTargetTemplate = uxml(`
  <ui:VisualElement name="g39-template-root" class="g39-template-root">
    <ui:Label name="g39-duplicate" text="duplicate one" />
    <ui:Label name="g39-duplicate" text="duplicate two" />
  </ui:VisualElement>
`);

const scrollTemplate = uxml(`
  <ui:VisualElement name="g310-template-root" class="g310-template-root">
    <ui:Label name="g310-scroll-label" class="g310-scroll-label" text="scroll template" />
    <ui:VisualElement name="g310-tall-content" style="height: 180px;" />
  </ui:VisualElement>
`);

const packageTemplate = uxml(`
  <ui:VisualElement name="g310-package-root" style="width: 80px; height: 40px;">
    <ui:VisualElement name="g310-package-child" style="width: 64px; height: 36px;" />
  </ui:VisualElement>
`);

const cycleA = uxml(`
  <ui:Template name="G311B" src="g3-11-b.uxml" />
  <ui:Instance template="G311B" name="g311-a-instance" />
`);

const cycleB = uxml(`
  <ui:Template name="G311A" src="g3-11-a.uxml" />
  <ui:Instance template="G311A" name="g311-b-instance" />
`);

const selfCycle = uxml(`
  <ui:Template name="G311Self" src="g3-11-self.uxml" />
  <ui:Instance template="G311Self" name="g311-self-instance" />
`);

// G3-12 preserves the previously measured slot geometry while using a
// relative helper path so the formal case is self-contained when emitted.
// The Unity dump shows the slot child alive in 6000.0.40f1, so this remains a
// known-unsupported measurement case rather than an implementation invitation.
const slotProbe = `<ui:UXML xmlns:ui="UnityEngine.UIElements">
  <ui:Template name="Window" src="templates/g3-12-window.uxml" />
  <ui:Instance template="Window" name="slot-instance">
    <ui:Label name="slot-content" slot="title" text="Alive" style="width: 80px; height: 20px;" />
  </ui:Instance>
</ui:UXML>
`;

const slotWindow = `<ui:UXML xmlns:ui="UnityEngine.UIElements">
  <ui:VisualElement name="slot-window" style="width: 200px; height: 100px; padding: 10px;">
    <ui:VisualElement name="slot-title" slot-name="title" style="width: 160px; height: 40px;" />
  </ui:VisualElement>
</ui:UXML>
`;

const slotDump = `{
  "metadata": {
    "unityVersion": "6000.0.40f1",
    "unityRevision": "6000.0.40f1 (157d81624ddf)",
    "pixelsPerPoint": 1.0,
    "editorSkin": "dark",
    "editorFont": { "name": "(builtin)", "size": 12, "style": "Normal" },
    "systemFont": {
      "smoothing": "2",
      "smoothingType": "2",
      "smoothingGamma": "0",
      "appliedDpi": "96"
    },
    "dumpedAtUtc": "2026-08-25T09:04:01.6197074Z"
  },
  "panel": { "width": 400, "height": 300 },
  "elements": {
    "slot-instance": { "x": 0, "y": 0, "width": 400, "height": 100 },
    "slot-window": { "x": 0, "y": 0, "width": 200, "height": 100 },
    "slot-title": { "x": 10, "y": 10, "width": 160, "height": 40 },
    "slot-content": { "x": 10, "y": 10, "width": 80, "height": 20 }
  }
}
`;

export const CASES: readonly TemplateCase[] = [
  {
    id: 'G3-1',
    question: 'One template and one instance with no instance child: measure the container baseline.',
    uxml: uxml(`
      <ui:Template name="G31Basic" src="templates/g3-1-basic.uxml" />
      <ui:VisualElement name="g31-holder" class="g31-holder">
        <ui:Instance template="G31Basic" name="g31-instance" />
        <ui:VisualElement name="g31-plain-baseline" class="g31-plain-baseline" />
      </ui:VisualElement>
    `),
    uss: `
      #g31-holder {
        width: 260px;
        height: 100px;
        flex-direction: column;
      }
      .g31-template-root,
      .g31-plain-baseline {
        width: 120px;
        height: 30px;
      }
    `,
    files: { 'templates/g3-1-basic.uxml': basicTemplate },
    probes: [
      probe('L1', 'What are the effective flex-grow, flex-shrink, and flex-basis values of the generated container?', 'computed-style', ['g31-instance', 'g31-plain-baseline', 'g31-template-root'], 'Compare the generated container with the plain VisualElement baseline; no TemplateContainer rule is supplied by this fixture.', ['flex-grow', 'flex-shrink', 'flex-basis']),
      probe('L2', 'Does the default Unity theme contain a TemplateContainer type selector rule?', 'computed-style', ['g31-instance', 'g31-plain-baseline'], 'Compare the generated container against an otherwise equivalent plain VisualElement before attributing differences to the default theme.', ['margin', 'padding', 'border-left-width', 'border-right-width']),
      probe('L3', 'What name, if any, is exposed for the generated TemplateContainer?', 'physical-tree', ['g31-instance', 'g31-template-root'], 'Inspect the physical hierarchy and names. An unnamed generated container is a meaningful result.', ['name']),
      probe('X2', 'What relative template src resolution is accepted from the entry UXML?', 'warning', ['G31Basic', 'templates/g3-1-basic.uxml'], 'Record the resolved asset and warnings; this reference is intentionally relative.', ['src', 'resolved-path']),
    ],
  },
  {
    id: 'G3-2',
    question: 'The same template instantiated three times in a vertical stack: expose accumulated container error.',
    uxml: uxml(`
      <ui:Template name="G32Repeated" src="templates/g3-2-repeated.uxml" />
      <ui:VisualElement name="g32-stack" class="g32-stack">
        <ui:Instance template="G32Repeated" name="g32-instance-1" />
        <ui:Instance template="G32Repeated" name="g32-instance-2" />
        <ui:Instance template="G32Repeated" name="g32-instance-3" />
      </ui:VisualElement>
    `),
    uss: `
      #g32-stack {
        width: 260px;
        height: 180px;
        flex-direction: column;
      }
      .g32-template-root {
        width: 120px;
        height: 30px;
        margin-bottom: 3px;
      }
    `,
    files: { 'templates/g3-2-repeated.uxml': repeatedTemplate },
    probes: [
      probe('accumulated-layout', 'Do three instances accumulate a nonzero or unexpected container contribution?', 'geometry', ['g32-stack', 'g32-instance-1', 'g32-instance-2', 'g32-instance-3'], 'Compare each top/height and the stack bottom. This is an observation, not an expected-value assertion.', ['top', 'height', 'bottom']),
    ],
  },
  {
    id: 'G3-3',
    question: 'Instance class plus inline style: identify which surface receives each declaration.',
    uxml: uxml(`
      <ui:Template name="G33Styled" src="templates/g3-3-inline-class.uxml" />
      <ui:VisualElement name="g33-holder" class="g33-holder">
        <ui:Instance template="G33Styled" name="g33-instance" class="g33-instance-class" style="width: 180px; height: 60px; padding-left: 7px;" />
      </ui:VisualElement>
    `),
    uss: `
      #g33-holder {
        width: 260px;
        height: 100px;
      }
      .g33-instance-class {
        margin-left: 11px;
        background-color: rgb(210, 230, 255);
      }
      .g33-template-root {
        width: 80px;
        height: 30px;
        background-color: rgb(255, 220, 210);
      }
    `,
    files: { 'templates/g3-3-inline-class.uxml': inlineAndClassTemplate },
    probes: [
      probe('L4', 'Does Instance style attach to the generated container or the template internal root?', 'geometry', ['g33-instance', 'g33-template-root'], 'Use the distinct inline width/height/padding and template width/height to identify the receiving node.', ['width', 'height', 'padding-left', 'margin-left']),
      probe('C3', 'Does Instance class attach to the generated container or the template internal root?', 'computed-style', ['g33-instance', 'g33-template-root'], 'The class has a unique margin and background; record the node that receives each value.', ['margin-left', 'background-color']),
    ],
  },
  {
    id: 'G3-4',
    question: 'Parent USS targets a template internal root and label through an instance.',
    uxml: uxml(`
      <ui:Template name="G34Cascade" src="templates/g3-4-cascade.uxml" />
      <ui:VisualElement name="g34-panel" class="g34-panel">
        <ui:Instance template="G34Cascade" name="g34-instance" />
        <ui:Label name="g34-outside-label" class="g34-internal-label" text="outside sibling" />
      </ui:VisualElement>
    `),
    uss: `
      #g34-panel {
        width: 320px;
        height: 120px;
        flex-direction: row;
      }
      #g34-panel > .g34-internal-root {
        width: 190px;
        height: 70px;
        background-color: rgb(240, 190, 190);
      }
      .g34-panel .g34-internal-label {
        color: rgb(20, 40, 220);
        font-size: 20px;
      }
    `,
    files: { 'templates/g3-4-cascade.uxml': cascadeTemplate },
    probes: [
      probe('C1', 'Can a parent direct-child selector reach the template internal root through Instance?', 'computed-style', ['g34-panel', 'g34-template-root'], 'Compare the direct-child rule on the internal root with the outside sibling; record selector reach.', ['width', 'height', 'background-color']),
      probe('C5', 'Can a parent stylesheet selector reach an element inside the template?', 'computed-style', ['g34-internal-label', 'g34-outside-label'], 'The descendant rule intentionally targets both an internal and an outside label.', ['color', 'font-size']),
    ],
  },
  {
    id: 'G3-5',
    question: 'Parent inherited properties applied around a template instance.',
    uxml: uxml(`
      <ui:Template name="G35Inherited" src="templates/g3-5-inherited.uxml" />
      <ui:VisualElement name="g35-parent" class="g35-parent">
        <ui:Instance template="G35Inherited" name="g35-instance" />
      </ui:VisualElement>
    `),
    uss: `
      #g35-parent {
        width: 280px;
        height: 100px;
        color: rgb(30, 80, 180);
        font-size: 18px;
        -unity-font-style: bold;
      }
      .g35-template-root {
        width: 160px;
        height: 40px;
      }
    `,
    files: { 'templates/g3-5-inherited.uxml': inheritedTemplate },
    probes: [
      probe('C2', 'Do inheritable parent properties cross the TemplateContainer boundary?', 'computed-style', ['g35-parent', 'g35-inherited-label'], 'Record inherited color, font size, and font style on the internal label.', ['color', 'font-size', '-unity-font-style']),
    ],
  },
  {
    id: 'G3-6',
    question: 'Template-internal Style plus parent Style: measure :root scope and stylesheet leakage.',
    uxml: uxml(`
      <Style src="templates/g3-6-parent.uss" />
      <ui:Template name="G36Scoped" src="templates/g3-6-scoped.uxml" />
      <ui:VisualElement name="g36-parent" class="g36-parent">
        <ui:Instance template="G36Scoped" name="g36-instance" />
        <ui:Label name="g36-outside" class="g36-template-only" text="outside sibling" />
      </ui:VisualElement>
    `),
    uss: '',
    files: {
      'templates/g3-6-parent.uss': `
      #g36-parent {
        width: 320px;
        height: 120px;
      }
      :root {
        color: rgb(20, 140, 20);
      }
      .g36-template-only {
        height: 22px;
        background-color: rgb(210, 210, 210);
      }
      `,
      'templates/g3-6-scoped.uxml': scopedStyleTemplate,
      'templates/g3-6-template.uss': `
        :root {
          color: rgb(180, 20, 20);
        }
        .g36-template-only {
          width: 150px;
          background-color: rgb(255, 225, 180);
        }
      `,
    },
    probes: [
      probe('C4', 'What node does :root in a template stylesheet select?', 'computed-style', ['g36-template-root', 'g36-template-only', 'g36-parent'], 'Compare template and parent colors and record the selected root.', ['color', 'width', 'background-color']),
      probe('C6', 'Does a template Style src leak its class rule to a parent sibling?', 'computed-style', ['g36-template-only', 'g36-outside'], 'The same class is present inside and outside the instance; compare width/background values.', ['width', 'background-color']),
    ],
  },
  {
    id: 'G3-7',
    question: 'Two-level nested template with an outer AttributeOverrides target.',
    uxml: uxml(`
      <ui:Template name="G37Outer" src="templates/g3-7-outer.uxml" />
      <ui:Instance template="G37Outer" name="g37-outer-instance">
        <AttributeOverrides element-name="g37-deep-label" text="outer override probe" />
      </ui:Instance>
    `),
    uss: `
      .g37-inner-root {
        width: 200px;
        height: 42px;
      }
    `,
    files: {
      'templates/g3-7-outer.uxml': nestedOuterTemplate,
      'templates/g3-7-inner.uxml': nestedInnerTemplate,
    },
    probes: [
      probe('O3', 'Can an element-name override on the outer instance reach a nested template element?', 'physical-tree', ['g37-deep-label', 'g37-outer-instance'], 'Record final text and target path; nested reach is the question, not a presumed success.', ['text', 'name']),
    ],
  },
  {
    id: 'G3-8',
    question: 'AttributeOverrides text/style values against template and parent USS.',
    uxml: uxml(`
      <ui:Template name="G38Override" src="templates/g3-8-override.uxml" />
      <ui:Instance template="G38Override" name="g38-instance">
        <AttributeOverrides element-name="g38-label" text="override text" style="color: rgb(220, 30, 30);" />
      </ui:Instance>
    `),
    uss: `
      .g38-label {
        color: rgb(20, 20, 220);
        font-size: 19px;
      }
    `,
    files: { 'templates/g3-8-override.uxml': overrideTemplate },
    probes: [
      probe('O1', 'In what order are AttributeOverrides applied relative to template defaults?', 'physical-tree', ['g38-label'], 'Record final text and style values and compare with the template source values.', ['text', 'style']),
      probe('O2', 'Does an AttributeOverrides style value win over USS for the same element?', 'computed-style', ['g38-label'], 'The template inline style, parent USS, and override style intentionally disagree.', ['color', 'font-size']),
    ],
  },
  {
    id: 'G3-9',
    question: 'Missing override target and duplicate element-name target.',
    uxml: uxml(`
      <ui:Template name="G39Duplicate" src="templates/g3-9-duplicate.uxml" />
      <ui:Instance template="G39Duplicate" name="g39-instance">
        <AttributeOverrides element-name="g39-duplicate" text="duplicate target override" />
        <AttributeOverrides element-name="g39-missing" text="missing target override" />
      </ui:Instance>
    `),
    uss: `
      .g39-template-root {
        width: 260px;
        height: 70px;
        flex-direction: column;
      }
    `,
    files: { 'templates/g3-9-duplicate.uxml': duplicateTargetTemplate },
    probes: [
      probe('O4', 'What happens when AttributeOverrides names no element?', 'warning', ['g39-missing'], 'Record warning/error behavior and whether rendering remains available; no failure mode is assumed.', ['warning', 'rendered']),
      probe('O5', 'What happens when multiple template elements share an override element-name?', 'physical-tree', ['g39-duplicate'], 'Record every matching node and final text to distinguish first/all/none behavior.', ['name', 'text']),
    ],
  },
  {
    id: 'G3-10',
    question: 'Template instance inside ScrollView: preserve the physical/logical-tree interaction probe.',
    uxml: uxml(`
      <ui:Template name="G310Scroll" src="templates/g3-10-scroll.uxml" />
      <ui:Template name="G310PackageProbe" src="project://database/Packages/com.uxml-preview.golden/g3-10-package.uxml" />
      <ui:ScrollView name="g310-scroll" mode="Vertical" class="g310-scroll">
        <ui:Instance template="G310Scroll" name="g310-instance" />
      </ui:ScrollView>
      <ui:Instance template="G310PackageProbe" name="g310-package-instance" />
    `),
    uss: `
      #g310-scroll {
        width: 260px;
        height: 100px;
      }
      .g310-template-root {
        width: 220px;
      }
        .g310-scroll-label {
        height: 24px;
      }
    `,
    files: {
      'templates/g3-10-scroll.uxml': scrollTemplate,
      'Packages/com.uxml-preview.golden/g3-10-package.uxml': packageTemplate,
    },
    probes: [
      probe('scrollview-tree', 'Does the physical template hierarchy remain observable inside ScrollView?', 'physical-tree', ['g310-scroll', 'g310-instance', 'g310-tall-content'], 'Record the hierarchy and scroll-content geometry separately; this is a context probe.', ['parent', 'top', 'height']),
      probe('X3', 'Does template lookup resolve a project-root-fixed Packages URL?', 'warning', ['G310PackageProbe', 'g310-package-root', 'g310-package-child'], 'The embedded com.uxml-preview.golden package supplies the exact UXML used by the preview fixture. The package root and child must both be present; a zero-child TemplateContainer is not resolution evidence.', ['src', 'resolved-path', 'warning', 'children']),
    ],
  },
  {
    id: 'G3-11',
    question: 'Mutual A/B cycle and self-reference: fail closed while preserving source text.',
    uxml: uxml(`
      <ui:Template name="G311A" src="templates/g3-11-a.uxml" />
      <ui:Template name="G311Self" src="templates/g3-11-self.uxml" />
      <ui:Instance template="G311A" name="g311-cycle-instance" />
      <ui:Instance template="G311Self" name="g311-self-instance" />
    `),
    uss: '',
    files: {
      'templates/g3-11-a.uxml': cycleA,
      'templates/g3-11-b.uxml': cycleB,
      'templates/g3-11-self.uxml': selfCycle,
    },
    probes: [
      probe('cycle', 'Do mutual and self template cycles fail closed without unbounded expansion?', 'warning', ['g311-cycle-instance', 'g311-self-instance'], 'Record bounded warnings/errors and whether the rest of the document remains loadable.', ['warning', 'depth', 'rendered']),
      probe('roundtrip', 'Are cycle source declarations preserved by serialization?', 'roundtrip', ['G311A', 'G311Self'], 'Compare source Template/Instance declarations before and after roundtrip; do not require expansion.', ['source', 'src', 'template']),
    ],
  },
  {
    id: 'G3-12',
    question: 'Known-unsupported slot probe measured on Unity 6000.0.40f1; retain the evidence without implementing slots.',
    uxml: slotProbe,
    uss: '',
    files: {
      'templates/g3-12-window.uxml': slotWindow,
      'measurements/unity-6000.0.40f1.json': slotDump,
    },
    probes: [
      probe('X1', 'Are slot-name/slot semantics alive in Unity 6000.0.40f1?', 'physical-tree', ['slot-instance', 'slot-window', 'slot-title', 'slot-content'], 'The preserved Unity dump shows slot-content alive at the slot-title position. This is known unsupported evidence and does not authorize slot implementation in this step.', ['slot', 'slot-name', 'parent', 'x', 'y', 'width', 'height']),
    ],
  },
];

export const TEMPLATE_MEASUREMENTS: readonly TemplateMeasurementId[] = [
  'L1', 'L2', 'L3', 'L4',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
  'O1', 'O2', 'O3', 'O4', 'O5',
  'X1', 'X2', 'X3',
];
