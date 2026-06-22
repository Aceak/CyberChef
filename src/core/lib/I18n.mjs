/**
 * Internationalisation (i18n) core module.
 *
 * Extracts all hardcoded English strings into locale JSON files so that adding
 * a new language only requires dropping a translated copy under locales/.
 *
 * Usage:
 *   await I18n.init("en");
 *   I18n.t("ui.controls.bake");          // "Bake!"
 *   I18n.t("op.name.to_base64");         // "To Base64"
 *   I18n.applyToDOM();                   // walk DOM and replace data-i18n markers
 *
 * Switching language:
 *   await I18n.changeLanguage("zh");
 *
 * Key naming convention:
 *   {domain}.{sub_category}.{logical_name}
 *   Dots separate hierarchy levels; underscores join words in leaf keys.
 *   All lowercase, no special characters.
 *   e.g. "ui.controls.bake", "op.name.to_base64", "cat.data_format"
 *
 * Supported data-i18n attributes:
 *   data-i18n             → replace textContent (preserves child elements e.g. <i> icons)
 *   data-i18n-title       → replace title attribute
 *   data-i18n-help-title  → replace data-help-title attribute
 *   data-i18n-help        → replace data-help attribute
 *   data-i18n-placeholder → replace placeholder attribute
 *
 * @author 3kk0
 * @copyright Crown Copyright 2026
 * @license Apache-2.0
 */

import enUI from "../locales/en/ui.json" with { type: "json" };
import enOptions from "../locales/en/options.json" with { type: "json" };
import enMessages from "../locales/en/messages.json" with { type: "json" };
import enOperations from "../locales/en/operations.json" with { type: "json" };
import enCategories from "../locales/en/categories.json" with { type: "json" };
import enHelp from "../locales/en/help.json" with { type: "json" };

class I18n {

    /** @type {string} Current locale */
    static locale = "en";

    /** @type {Object<string, Object>} Loaded translation data, e.g. { en: {...}, zh: {...} } */
    static data = {};

    /**
     * Initialise the i18n module.
     * English data is bundled at build time via static imports; other locales
     * are loaded on demand through dynamic import().
     *
     * @param {string} locale - Target locale, e.g. "en"
     */
    static async init(locale) {
        // The tree structure mirrors the dot-path key hierarchy so that
        // I18n.t("op.name.to_base64") resolves to data.en.op.name.to_base64
        this.data.en = {
            ui:      enUI,
            options: enOptions,
            messages: enMessages,
            op:      enOperations,
            cat:     enCategories,
            // eslint-disable-next-line camelcase
            ui_help: enHelp
        };

        if (locale !== "en") {
            await this.loadLocale(locale);
        }

        this.locale = locale;
    }

    /**
     * Dynamically load a non-English locale at runtime.
     *
     * @param {string} locale
     */
    static async loadLocale(locale) {
        try {
            const modules = await Promise.all([
                import(/* webpackChunkName: "i18n-[request]" */ `../locales/${locale}/ui.json`),
                import(/* webpackChunkName: "i18n-[request]" */ `../locales/${locale}/options.json`),
                import(/* webpackChunkName: "i18n-[request]" */ `../locales/${locale}/messages.json`),
                import(/* webpackChunkName: "i18n-[request]" */ `../locales/${locale}/operations.json`),
                import(/* webpackChunkName: "i18n-[request]" */ `../locales/${locale}/categories.json`),
                import(/* webpackChunkName: "i18n-[request]" */ `../locales/${locale}/help.json`)
            ]);
            this.data[locale] = {
                ui:      modules[0].default || modules[0],
                options: modules[1].default || modules[1],
                messages: modules[2].default || modules[2],
                op:      modules[3].default || modules[3],
                cat:     modules[4].default || modules[4],
                // eslint-disable-next-line camelcase
                ui_help: modules[5].default || modules[5]
            };
        } catch (err) {
            log.warn(`Failed to load locale '${locale}': ${err.message}`);
        }
    }

    /**
     * Look up a translation by dot-separated key.
     *
     * Lookup order:
     *   1. Current locale
     *   2. English fallback (when current is not en)
     *   3. Warn and return the raw key
     *
     * @param {string} key - Dot-separated key, e.g. "ui.controls.bake"
     * @param {Object} [vars] - Optional placeholder substitutions, e.g. { name: "Foo" }
     * @returns {string} The resolved translation string
     */
    static t(key, vars) {
        let val = this._lookup(this.data[this.locale], key);

        if (val === null && this.locale !== "en") {
            val = this._lookup(this.data.en, key);
        }

        if (val === null) {
            log.warn(`[i18n] Missing key: "${key}"`);
            return key;
        }

        // Replace {{placeholder}} markers with provided values
        if (vars && typeof val === "string") {
            for (const [k, v] of Object.entries(vars)) {
                val = val.replace(new RegExp("\\{\\{" + k + "\\}\\}", "g"), v);
            }
        }

        return val;
    }

    /**
     * Walk the data tree following a dot-path to find a string value.
     *
     * @param {Object} data - Loaded locale data
     * @param {string} key  - Dot-separated path, e.g. "ui.controls.bake"
     * @returns {string|null}
     */
    static _lookup(data, key) {
        if (!data) return null;

        const parts = key.split(".");
        let current = data;

        for (const part of parts) {
            if (current == null || typeof current !== "object") return null;
            if (!Object.prototype.hasOwnProperty.call(current, part)) return null;
            current = current[part];
        }

        return typeof current === "string" ? current : null;
    }

    /**
     * Switch the active language at runtime.
     * Loads the new locale on demand, then re-applies translations to the DOM.
     *
     * @param {string} locale - Target locale
     */
    static async changeLanguage(locale) {
        if (locale !== "en" && !this.data[locale]) {
            await this.loadLocale(locale);
        }

        if (this.data[locale]) {
            this.locale = locale;
            this.applyToDOM();
        }
    }

    /**
     * Walk the entire DOM and replace every element bearing a data-i18n
     * attribute with the corresponding translation for the current locale.
     *
     * Supported attributes:
     *   data-i18n             → replace textContent (text nodes only; child elements survive)
     *   data-i18n-title       → replace title attribute
     *   data-i18n-help-title  → replace data-help-title attribute
     *   data-i18n-help        → replace data-help attribute
     *   data-i18n-placeholder → replace placeholder attribute
     */
    static applyToDOM() {
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            const text = this.t(key);
            this._setTextContent(el, text);
        });

        document.querySelectorAll("[data-i18n-title]").forEach(el => {
            el.setAttribute("title", this.t(el.getAttribute("data-i18n-title")));
        });

        document.querySelectorAll("[data-i18n-help-title]").forEach(el => {
            el.setAttribute("data-help-title", this.t(el.getAttribute("data-i18n-help-title")));
        });

        document.querySelectorAll("[data-i18n-help]").forEach(el => {
            el.setAttribute("data-help", this.t(el.getAttribute("data-i18n-help")));
        });

        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            el.setAttribute("placeholder", this.t(el.getAttribute("data-i18n-placeholder")));
        });
    }

    /**
     * Set the visible text of an element, preserving any child elements
     * (e.g. <i> icon nodes). Only the first text node is replaced.
     *
     * @param {Element} el
     * @param {string} text
     */
    static _setTextContent(el, text) {
        for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                node.textContent = text;
                return;
            }
        }
        // No text node found — create one (should rarely happen for data-i18n targets)
        if (el.childNodes.length === 0) {
            el.textContent = text;
        }
    }
}

export default I18n;
