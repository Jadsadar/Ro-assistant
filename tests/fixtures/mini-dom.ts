/**
 * The smallest DOM that `scripts/legacy-page/ro-assistant-chat.js` can run
 * against, so its tab-ordering logic can be tested as shipped rather than
 * reimplemented in the test.
 *
 * Only what that script touches is modelled, but the parts it depends on
 * behave like the real thing: `appendChild`/`insertBefore` move a node rather
 * than copying it (a node has one parent), and `textContent` is the
 * concatenation of the subtree's text.
 */

export class MiniElement {
  readonly tagName: string;
  children: MiniElement[] = [];
  parentElement: MiniElement | null = null;
  style: Record<string, string> = {};
  id = "";
  innerHTML = "";

  private text = "";
  private readonly attributes = new Map<string, string>();
  private readonly classes: Set<string>;

  constructor(tagName: string, className = "") {
    this.tagName = tagName;
    this.classes = new Set(className ? className.split(" ") : []);
  }

  readonly classList = {
    contains: (name: string) => this.classes.has(name),
    add: (name: string) => void this.classes.add(name),
    remove: (name: string) => void this.classes.delete(name),
  };

  get className(): string {
    return [...this.classes].join(" ");
  }

  set className(value: string) {
    this.classes.clear();
    for (const name of value.split(" ")) if (name) this.classes.add(name);
  }

  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.text = value;
    this.children = [];
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(): void {}

  appendChild(node: MiniElement): MiniElement {
    node.parentElement?.detach(node);
    node.parentElement = this;
    this.children.push(node);
    return node;
  }

  insertBefore(node: MiniElement, reference: MiniElement): MiniElement {
    node.parentElement?.detach(node);
    const at = this.children.indexOf(reference);
    node.parentElement = this;
    this.children.splice(at < 0 ? this.children.length : at, 0, node);
    return node;
  }

  querySelector(selector: string): MiniElement | null {
    return this.matches(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): MiniElement[] {
    return this.matches(selector);
  }

  private detach(node: MiniElement): void {
    const at = this.children.indexOf(node);
    if (at >= 0) this.children.splice(at, 1);
    node.parentElement = null;
  }

  private descendants(into: MiniElement[] = []): MiniElement[] {
    for (const child of this.children) {
      into.push(child);
      child.descendants(into);
    }
    return into;
  }

  /** Supports only the two forms the script uses: ".class" and "tag". */
  private matches(selector: string): MiniElement[] {
    const name = selector.trim().replace(/^\./, "");
    return this.descendants().filter((node) =>
      selector.startsWith(".")
        ? node.classList.contains(name)
        : node.tagName === name,
    );
  }
}
