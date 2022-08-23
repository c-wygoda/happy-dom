import IShadowRoot from '../../../nodes/shadow-root/IShadowRoot';
import IElement from '../../../nodes/element/IElement';
import IDocument from '../../../nodes/document/IDocument';
import IHTMLStyleElement from '../../../nodes/html-style-element/IHTMLStyleElement';
import INodeList from '../../../nodes/node/INodeList';
import CSSStyleDeclarationPropertyManager from './CSSStyleDeclarationPropertyManager';
import ICSSStyleDeclarationPropertyValue from './ICSSStyleDeclarationPropertyValue';
import NodeTypeEnum from '../../../nodes/node/NodeTypeEnum';
import CSSRuleTypeEnum from '../../CSSRuleTypeEnum';
import CSSMediaRule from '../../rules/CSSMediaRule';
import CSSRule from '../../CSSRule';
import CSSStyleRule from '../../rules/CSSStyleRule';

const INHERITED_PROPERTIES = [
	'border-collapse',
	'border-spacing',
	'caption-side',
	'color',
	'cursor',
	'direction',
	'empty-cells',
	'font-family',
	'font-size',
	'font-style',
	'font-variant',
	'font-weight',
	'font-size-adjust',
	'font-stretch',
	'font',
	'letter-spacing',
	'line-height',
	'list-style-image',
	'list-style-position',
	'list-style-type',
	'list-style',
	'orphans',
	'quotes',
	'tab-size',
	'text-align',
	'text-align-last',
	'text-decoration-color',
	'text-indent',
	'text-justify',
	'text-shadow',
	'text-transform',
	'visibility',
	'white-space',
	'widows',
	'word-break',
	'word-spacing',
	'word-wrap'
];

/**
 * CSS Style Declaration utility
 */
export default class CSSStyleDeclarationElement {
	/**
	 * Returns element style properties.
	 *
	 * @param element Element.
	 * @param [computed] Computed.
	 * @returns Element style properties.
	 */
	public static getElementStyle(
		element: IElement,
		computed: boolean
	): CSSStyleDeclarationPropertyManager {
		if (computed) {
			return this.getComputedElementStyle(element);
		}

		return new CSSStyleDeclarationPropertyManager(element['_attributes']['style']?.value);
	}

	/**
	 * Returns style sheets.
	 *
	 * @param element Element.
	 * @returns Style sheets.
	 */
	private static getComputedElementStyle(element: IElement): CSSStyleDeclarationPropertyManager {
		const targetElement: { element: IElement; cssText: string } = { element, cssText: '' };
		const parentElements: Array<{ element: IElement; cssText: string }> = [];
		const inheritedProperties: { [k: string]: ICSSStyleDeclarationPropertyValue } = {};
		let shadowRootElements: Array<{ element: IElement; cssText: string }> = [targetElement];
		let currentNode: IElement | IShadowRoot | IDocument = <IElement | IShadowRoot | IDocument>(
			element.parentNode
		);

		if (!element.isConnected) {
			return new CSSStyleDeclarationPropertyManager();
		}

		while (currentNode) {
			const styleAndElement = { element: <IElement>currentNode, cssText: '' };

			if (currentNode.nodeType === NodeTypeEnum.elementNode) {
				parentElements.unshift(styleAndElement);
				shadowRootElements.unshift(styleAndElement);
			}

			currentNode = <IElement | IShadowRoot | IDocument>currentNode.parentNode;

			if (currentNode) {
				if (currentNode === element.ownerDocument) {
					const styleSheets = <INodeList<IHTMLStyleElement>>(
						element.ownerDocument.querySelectorAll('style')
					);
					for (const styleSheet of styleSheets) {
						this.applyCSSTextToElements(shadowRootElements, styleSheet.sheet.cssRules);
					}
					currentNode = null;
				} else if ((<IShadowRoot>currentNode).host) {
					const styleSheets = <INodeList<IHTMLStyleElement>>(
						(<IShadowRoot>currentNode).querySelectorAll('style')
					);
					for (const styleSheet of styleSheets) {
						this.applyCSSTextToElements(shadowRootElements, styleSheet.sheet.cssRules);
					}
					currentNode = (<IShadowRoot>currentNode).host;
					shadowRootElements = [];
				}
			}
		}

		for (const parentElement of parentElements) {
			const propertyManager = new CSSStyleDeclarationPropertyManager(
				parentElement.cssText + (parentElement.element['_attributes']['style']?.value || '')
			);
			for (const name of Object.keys(propertyManager.properties)) {
				if (INHERITED_PROPERTIES.includes(name)) {
					inheritedProperties[name] = propertyManager.properties[name];
				}
			}
		}

		const targetPropertyManager = new CSSStyleDeclarationPropertyManager(
			targetElement.cssText + (targetElement.element['_attributes']['style']?.value || '')
		);

		Object.assign(inheritedProperties, targetPropertyManager.properties);
		targetPropertyManager.properties = inheritedProperties;

		return targetPropertyManager;
	}

	/**
	 * Applies CSS text to elements.
	 *
	 * @param elements Elements.
	 * @param cssRules CSS rules.
	 */
	private static applyCSSTextToElements(
		elements: Array<{ element: IElement; cssText: string }>,
		cssRules: CSSRule[]
	): void {
		if (!elements.length) {
			return;
		}

		const defaultView = elements[0].element.ownerDocument.defaultView;

		for (const rule of cssRules) {
			if (rule.type === CSSRuleTypeEnum.styleRule) {
				for (const element of elements) {
					const selectorText = (<CSSStyleRule>rule).selectorText;

					if (selectorText && element.element.matches(selectorText)) {
						const firstBracket = rule.cssText.indexOf('{');
						const lastBracket = rule.cssText.lastIndexOf('}');
						element.cssText += rule.cssText.substring(firstBracket + 1, lastBracket);
					}
				}
			} else if (
				rule.type === CSSRuleTypeEnum.mediaRule &&
				defaultView.matchMedia((<CSSMediaRule>rule).conditionalText).matches
			) {
				this.applyCSSTextToElements(elements, (<CSSMediaRule>rule).cssRules);
			}
		}
	}
}
