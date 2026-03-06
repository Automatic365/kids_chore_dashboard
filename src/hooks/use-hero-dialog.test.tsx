import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useHeroDialog } from "@/hooks/use-hero-dialog";

if (typeof HTMLDialogElement !== "undefined") {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
  }
}

function Harness() {
  const { confirm, dialogNode } = useHeroDialog();
  const [result, setResult] = useState<string>("pending");

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          const accepted = await confirm({
            title: "Confirm Action",
            description: "Are you sure?",
            confirmLabel: "Yes",
            cancelLabel: "No",
          });
          setResult(String(accepted));
        }}
      >
        Open
      </button>
      <p data-testid="result">{result}</p>
      {dialogNode}
    </div>
  );
}

describe("useHeroDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("resolves true when confirm is clicked", async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Confirm Action")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(await screen.findByTestId("result")).toHaveTextContent("true");
  });

  it("resolves false when cancelled via escape cancel event", async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));

    expect(await screen.findByTestId("result")).toHaveTextContent("false");
  });
});
