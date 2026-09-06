import assert from 'node:assert/strict';

/** Run against the real Reporting screen after selecting the Risk Register report. */
export async function checkGrcFormLayout(page) {
  const results = [];
  for (const text of ['Summary Statistics', 'Risk Table', 'Risks by Rating', 'Appetite Breaches', 'Unlinked Risks']) {
    const control = page.locator('.MuiFormControlLabel-root').filter({ hasText: new RegExp(`^${text}$`) });
    await control.scrollIntoViewIfNeeded();
    const result = await control.evaluate(element => {
      const checkbox = element.querySelector('input[type="checkbox"]');
      const label = Array.from(element.children).find(child => !child.contains(checkbox));
      if (!checkbox || !label) throw new Error('Report section control is missing its checkbox or visible label.');
      const inputRect = checkbox.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      return {
        text: element.textContent,
        direction: getComputedStyle(element).flexDirection,
        inputRight: inputRect.right,
        labelLeft: labelRect.left,
        centerDifference: Math.abs(inputRect.y + inputRect.height / 2 - labelRect.y - labelRect.height / 2),
      };
    });
    assert.equal(result.direction, 'row', `${text}: checkbox and label must use a horizontal row`);
    assert(result.labelLeft >= result.inputRight - 2, `${text}: label must sit to the right of its checkbox`);
    assert(result.centerDifference < 3, `${text}: checkbox and label must align vertically`);
    results.push(result);
  }
  return results;
}
