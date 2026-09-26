import React from 'react';
import { useBranding } from '../hooks/useBranding';

function Footer() {
  const { organizationName, configured } = useBranding();

  return (
    <footer className="footer">
      <div className="footer-content">
        <p className="confidentiality">
          {/* Until an organisation is named, drop the clause entirely rather than
              saying "of this organization", which reads like a placeholder. */}
          ⚠️ CONFIDENTIAL: This system contains proprietary information
          {configured ? ` of ${organizationName}` : ''}.
          Unauthorized access, use, or disclosure is strictly prohibited.
        </p>
        <p className="powered-by">
          Powered by <a href="https://turneratech.com" target="_blank" rel="noopener noreferrer">TurneraTech.com</a>
        </p>
      </div>
    </footer>
  );
}

export default Footer;
