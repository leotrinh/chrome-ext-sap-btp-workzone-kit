const EXTENSION_VERSION = "0.3.0";

export function AboutPanel() {
  return (
    <section className="about-panel">
      <p>Version {EXTENSION_VERSION}</p>
      <p>
        SAP BTP Workzone Kit is an independent browser extension. It is not affiliated
        with, endorsed by, sponsored by, or produced by SAP SE. SAP, SAP BTP, SAPUI5, and
        SAP Build Work Zone are trademarks or registered trademarks of SAP SE or its
        affiliates.
      </p>
      <ul>
        <li>
          <a
            href="https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit"
            target="_blank"
            rel="noreferrer"
          >
            GitHub repository
          </a>
        </li>
        <li>
          <a
            href="https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit/blob/main/PRIVACY.md"
            target="_blank"
            rel="noreferrer"
          >
            Privacy
          </a>
        </li>
        <li>
          <a
            href="https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit/blob/main/SECURITY.md"
            target="_blank"
            rel="noreferrer"
          >
            Security
          </a>
        </li>
        <li>
          <a
            href="https://github.com/leotrinh/chrome-ext-sap-btp-workzone-kit/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noreferrer"
          >
            Contributing
          </a>
        </li>
        <li>
          <a href="https://ui5.sap.com/versionoverview.html" target="_blank" rel="noreferrer">
            SAPUI5 Version Overview
          </a>
        </li>
      </ul>
    </section>
  );
}
