// CSS Variables Polyfill for older TV browsers
// This ensures CSS custom properties work on browsers that don't support them

(function() {
    // Test if CSS variables are supported
    const testElement = document.createElement('div');
    testElement.style.setProperty('--test', 'test');
    const supportsCustomProperties = testElement.style.getPropertyValue('--test') === 'test';

    if (!supportsCustomProperties) {
        console.warn('CSS Variables not supported, applying fallback values');

        // Define all CSS variables as inline styles on root element
        const cssVars = {
            '--primary-color': '#2563eb',
            '--primary-hover': '#1d4ed8',
            '--secondary-color': '#64748b',
            '--danger-color': '#ef4444',
            '--success-color': '#10b981',
            '--bg-color': '#f8fafc',
            '--card-bg': '#ffffff',
            '--text-primary': '#0f172a',
            '--text-secondary': '#64748b',
            '--border-color': '#e2e8f0',
            '--shadow': '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
        };

        // Apply to document root
        const root = document.documentElement;
        for (const [key, value] of Object.entries(cssVars)) {
            root.style.setProperty(key, value);
        }

        // Replace var() in all stylesheets
        function replaceCSSVariables() {
            const sheets = document.styleSheets;

            for (let i = 0; i < sheets.length; i++) {
                try {
                    const rules = sheets[i].cssRules || sheets[i].rules;
                    if (!rules) continue;

                    for (let j = 0; j < rules.length; j++) {
                        const rule = rules[j];
                        if (!rule.style) continue;

                        for (let k = 0; k < rule.style.length; k++) {
                            const prop = rule.style[k];
                            const value = rule.style.getPropertyValue(prop);

                            if (value && value.includes('var(--')) {
                                let newValue = value;
                                for (const [varName, varValue] of Object.entries(cssVars)) {
                                    newValue = newValue.replace(new RegExp('var\\(' + varName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\)', 'g'), varValue);
                                }
                                rule.style.setProperty(prop, newValue);
                            }
                        }
                    }
                } catch (e) {
                    // Cross-origin stylesheets may throw errors, ignore them
                    console.warn('Could not process stylesheet:', e);
                }
            }
        }

        // Run after DOM is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', replaceCSSVariables);
        } else {
            replaceCSSVariables();
        }
    }
})();
