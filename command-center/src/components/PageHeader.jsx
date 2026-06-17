import React from 'react';

export default function PageHeader({ title, description, isSmallSubtext = false, textColor, subtextColor }) {
  const styles = {
    headline: {
      color: textColor || "#0F172A",
      fontSize: "30px",
      fontWeight: "800",
      fontFamily: '"Inter", sans-serif',
      letterSpacing: "-0.025em",
    },
    subtext: {
      color: subtextColor || "#475569",
      fontSize: isSmallSubtext ? "14px" : "16px",
      fontWeight: "500",
      fontFamily: '"Inter", sans-serif',
    },
  };

  return (
    <div className="mb-6">
      <h1 style={styles.headline}>{title}</h1>
      <p style={styles.subtext}>{description}</p>
    </div>
  );
}