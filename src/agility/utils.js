const getDynamicPageItem = ({ contentID, agilityItem }) => {
	if (contentID > 0 && agilityItem && agilityItem.itemJson) {
		return JSON.parse(agilityItem.itemJson);
	}
	return null;
}

const buildPageViewModel = ({ pageContext, data, location }) => {

	//if for whatever reason we get no page, kick out
	if (data.agilitypage === null) return null;

	//Check if we have a dynamic page item contentID, if so, we are rendering a dynamic page and should pass the content item to Modules
	const dynamicPageItem = getDynamicPageItem({
		contentID: pageContext.contentID,
		agilityItem: data.agilityitem
	});

	const page = JSON.parse(data.agilitypage.pageJson);

	//set the title from the page context...
	page.title = pageContext.title;

	//do any custom processing on the page and stuff...
	page.seo = customSEOProcessing({ pageContext, data, page, dynamicPageItem, location });


	//build the our viewModel
	return {
		page: page,
		dynamicPageItem: dynamicPageItem,
		isPreview: pageContext.isPreview
	}
}


/**
 * Perform processing on dynamic page items that want to update stuff in the page seo content.
 */
const customSEOProcessing = ({ pageContext, data, page, dynamicPageItem, location }) => {

	let metaDescription = null;
	let metaHTML = null;

	let seo = {
		metaDescription: null,
		metaHTML: null
	};

	if (page.seo) {
		seo = page.seo;
	}

	if (dynamicPageItem !== null) {

		// *** special case for blog posts ***
		if (dynamicPageItem.properties.definitionName === "BlogPost") {

			//build the meta description
			metaDescription = null;
			if (dynamicPageItem.seo && dynamicPageItem.seo.metaDescription) metaDescription = dynamicPageItem.seo.metaDescription;
			if (metaDescription === null) {
				metaDescription = dynamicPageItem.customFields.excerpt;
				if (metaDescription && metaDescription.length > 240) metaDescription = metaDescription.substring(0, 240) + "...";
			}

			let canonicalUrl = `https://agilitycms.com${location.pathname}`;

			let category = null;
			let image = null;

			if (dynamicPageItem.customFields.category && dynamicPageItem.customFields.category.customFields) {
				category = dynamicPageItem.customFields.category.customFields.title;
			}

			if (dynamicPageItem.customFields.postImage) image = dynamicPageItem.customFields.postImage;

			seo.metaDescription = metaDescription;
			seo.twitterCard = "summary_large_image";
			seo.ogType = "article";
			seo.category = category;
			seo.canonicalUrl = canonicalUrl;
			seo.image = image;

		}
	}

	return seo


}


const getLinkedContentItem = ({ type, linkedContentFieldName }) => {
	const fieldResolver =
	{
		//we are telling it is going to return the 'agilityAuthor' node type
		type: type,
		//this is the function that is going to resolve it
		resolve: async (source, args, context, info) => {
			const fieldObj = source.customFields[linkedContentFieldName];
			if (!fieldObj) {
				return null;
			}

			const contentID = parseInt(fieldObj.contentid);
			if (isNaN(contentID) || contentID < 1) {
				return null;
			}


			//query the graphql nodes to find the item you want to return
			const node = context.nodeModel.runQuery({
				//find the author that matches our ID and language code
				query: {
					filter: {
						contentID: { eq: source.customFields[linkedContentFieldName].contentid },
						languageCode: { eq: source.languageCode }
					}
				},
				type: type,
				//tell it to stop searching once we found our item
				firstOnly: true,
			})
			return node;
		}
	}
	return fieldResolver;
}

const getLinkedContentList = ({ type, linkedContentFieldName }) => {
	const fieldResolver =
	{
		type: [type],
		resolve: (source, args, context, info) => {
			const list = context.nodeModel.getAllNodes({ type });
			const filteredList = list.filter(
				item => item.properties.referenceName === source.customFields[linkedContentFieldName].referencename
			)
			return filteredList;
		}
	}

	return fieldResolver;
}

const getDynamicPageItemSitemapNode = () => {
	const fieldResolver =
	{
		type: 'agilitySitemapNode',
		resolve: async (source, args, context, info) => {
			const node = context.nodeModel.runQuery({
				query: {
					filter: {
						contentID: { eq: source.contentID },
						languageCode: { eq: source.languageCode }
					}
				},
				type: `agilitySitemapNode`,
				firstOnly: true
			})
			return node;
		}
	}

	return fieldResolver;
}

const renderHTML = (html) => {
	if (!html) return { __html: "" };
	return { __html: cleanHTML(html) };
}

const cleanHTML = (html) => {
	if (!html) return ""

	//HACK for Agility CMS Website
	html = html.replace(/http:\/\/cdn.agilitycms.com\/agility-cms-website/gi, "https://media.agilitycms.com");
	html = html.replace(/http:\/\/media.agilitycms.com/gi, "https://media.agilitycms.com");

	//fix '~' in links in HTML
	return html.replace(/href="~\//gi, 'href="/')
}

module.exports = {
	buildPageViewModel,
	getLinkedContentList,
	getDynamicPageItemSitemapNode,
	getLinkedContentItem,
	renderHTML,
	cleanHTML
}