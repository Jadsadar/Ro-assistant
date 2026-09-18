import { EmbeddedChat } from "@/components/calculator-v3/embedded-chat";

/**
 * The Chat panel on its own, so the legacy calculator can host it inside the
 * accordion tab that is injected after "Item Descriptions".
 */
export default function CalculatorV3ChatPage() {
  return <EmbeddedChat />;
}
