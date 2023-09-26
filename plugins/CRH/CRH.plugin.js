/**
 * @name CRH
 * @author CelestialReaver
 * @version 0.1
 * @description Plugin to ease and assist with theme and plugin development and customizations.
 * @authorId 859547769798656001
 * @authorLink https://github.com/CelestialReaver
 * @website https://github.com/CelestialReaver/BetterDiscord
 * @source https://github.com/CelestialReaver/BetterDiscord/tree/main/plugins/CRH/CRH.plugin.js
 */

/*@cc_on
@if (@_jscript)
	
	// Offer to self-install for clueless users that try to run this directly.
	var shell = WScript.CreateObject('WScript.Shell');
	var fs = new ActiveXObject('Scripting.FileSystemObject');
	var pathPlugins = shell.ExpandEnvironmentStrings('%APPDATA%\\BetterDiscord\\plugins');
	var pathSelf = WScript.ScriptFullName;
	// Put the user at ease by addressing them in the first person
	shell.Popup('It looks like you\'ve mistakenly tried to run me directly. \n(Don\'t do that!)', 0, 'I\'m a plugin for BetterDiscord', 0x30);
	if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
		shell.Popup('I\'m in the correct folder already.\nJust reload Discord with Ctrl+R.', 0, 'I\'m already installed', 0x40);
	} else if (!fs.FolderExists(pathPlugins)) {
		shell.Popup('I can\'t find the BetterDiscord plugins folder.\nAre you sure it\'s even installed?', 0, 'Can\'t install myself', 0x10);
	} else if (shell.Popup('Should I copy myself to BetterDiscord\'s plugins folder for you?', 0, 'Do you need some help?', 0x34) === 6) {
		fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
		// Show the user where to put plugins in the future
		shell.Exec('explorer ' + pathPlugins);
		shell.Popup('I\'m installed!\nJust reload Discord with Ctrl+R.', 0, 'Successfully installed', 0x40);
	}
	WScript.Quit();

@else@*/

/* global DiscordNative */
var CRH = (() => {
	/* Setup */

	const config = {
		main: "index.js",
		info: {
			name: "CRH",
			authors: [
				{
					name: "CelestialReaver",
					discord_id: "859547769798656001",
					github_username: "CelestialReaver",
					twitter_username: "",
				},
			],
			version: "1.0.25",
			description:
				"Plugin to ease and assist with theme and plugin development and customizations.",
			github: "https://github.com/CelestialReaver",
			github_raw:
				"https://raw.githubusercontent.com/CelestialReaver/BetterDiscord/master/plugins/CRH/CRH.plugin.js",
		},
		changelog: [
			{
				// title: 'Bugs Squashed!',
				// type: 'fixed',
				// items: [
				// 	'Displays properly again.'
				// ]
				// title: 'Evolving?',
				// type: 'improved',
				// items: [
				// 	'Re-enabled hover tooltip setting. We\'re back using React.'
				// ]
				title: "Initial Release",
				type: "Release",
				items: ["This is the initial release of the CRH plugin."],
			},
		],
	};

	/* Utility */

	const { log, info, warn, debug, error } = (() => {
		const useParts = () => [
			`%c[${config.info.name}]%c %s`,
			"color: #3A71C1; font-weight: 700;",
			"",
			new Date().toUTCString(),
		];

		return Object.fromEntries(
			["log", "info", "warn", "debug", "error"].map((type) => [
				type,
				function () {
					console.groupCollapsed.apply(null, useParts());
					console[type].apply(null, arguments);
					console.groupEnd();
				},
			])
		);
	})();

	/* Build */

	const buildPlugin = ([Plugin, Api]) => {
		const {
			Toasts,
			Logger,
			Patcher,
			Settings,
			Utilities,
			ReactTools,
			DOMTools,
			DiscordModules,
			WebpackModules,
			DiscordSelectors,
			PluginUtilities,
		} = Api;
		const { SettingPanel, SettingGroup, ColorPicker, RadioGroup, Switch } =
			Settings;
		const { React, ReactDOM } = DiscordModules;
		// @ts-ignore
		const { clipboard } = DiscordNative;

		const queryStrings = ["ANIMATE_CHAT_AVATAR", "showUsernamePopout"];
		const MessageHeader = WebpackModules.find((mod) => {
			if (!mod || !mod.default) return false;
			let s = "";
			try {
				s = mod.default.toString([]);
			} catch (e) {
				s = JSON.stringify(mod.default);
			}
			return queryStrings.every((n) => s.includes(n));
		});

		const has = Object.prototype.hasOwnProperty;
		const MessageClasses = {
			...WebpackModules.getByProps("message", "groupStart"),
			...WebpackModules.getByProps("compact", "cozy", "username"),
			...WebpackModules.getByProps("username", "zalgo", "timestamp", "header"),
		};

		const TextElement = WebpackModules.getByDisplayName("LegacyText");
		const TooltipWrapper = WebpackModules.getByPrototypes("renderTooltip");

		const options = [
			{
				name: "Before",
				desc: "Place the tag before the username.",
				value: 0,
			},
			{
				name: "After",
				desc: "Place the tag after the username.",
				value: 1,
			},
		];

		const ErrorBoundary = class ErrorBoundary extends React.Component {
			constructor(props) {
				super(props);
				this.state = { hasError: false };
			}

			static getDerivedStateFromError(error) {
				return { hasError: true };
			}

			componentDidCatch(err, info) {
				error(err);
			}

			render() {
				if (this.state.hasError)
					return React.createElement("div", {
						className: `${config.info.name}-error`,
						children: [
							React.createElement(TextElement, {
								color: TextElement.Colors.ERROR,
								children: [`${config.info.name} Component Error!`],
							}),
						],
					});
				return this.props.children;
			}
		};

		const WrapBoundary = (Original) => (props) =>
			React.createElement(
				ErrorBoundary,
				null,
				React.createElement(Original, props)
			);

		const getTagProps = (props, classes) => ({
			className: `${props.hover ? "tooltip-wrapper" : ""} ${classes.join(
				" "
			)}`.trim(),
			children: [
				React.createElement("span", {
					className: "tag",
					children: [props.id],
					onDoubleClick: (e) => props.onDoubleClick(e),
				}),
			],
		});

		const getTagElement = (props, classes) => {
			return (cProps) =>
				React.createElement(
					"span",
					Object.assign(getTagProps(props, classes), props.hover && cProps)
				);
		};

		const getTagClasses = (props) =>
			Array.isArray(props.classes) ? props.classes : [];

		const Tag = (props) => {
			const classes = getTagClasses(props);
			if (!classes.includes("tagID")) classes.unshift("tagID");
			return React.createElement(TooltipWrapper, {
				position: TooltipWrapper.Positions.TOP,
				color: TooltipWrapper.Colors.PRIMARY,
				text: props.text,
				children: getTagElement(props, classes),
			});
		};

		return class CRH extends Plugin {
			#config;
			#meta;

			/**
			 * @param {MetaData} meta
			 */
			constructor(meta) {
				super();
				this.#config = config;
				this.#meta = meta;
				this.promises = {
					state: { cancelled: false },
					cancel() {
						this.state.cancelled = true;
					},
					restore() {
						this.state.cancelled = false;
					},
				};
				this.default = {
					colors: [
						0x798aed, 0x263239, 0xc792ea, 0xf95479, 0xffcb6b, 0x82aaff,
						0x99ddf3, 0x718184, 0xf78c6a, 0xc3e88d,
					],
					color: "#798AED",
					tagPosition: 0,
					hoverTip: false,
				};
				this.settings = null;
				this._css;
				this.css = `
					@import 'https://fonts.googleapis.com/css?family=Roboto|Inconsolata';
				
					.tagID {
						font-size: 10px;
						letter-spacing: 0.025rem;
						position: relative;
						/*top: 3px;*/
						height: 9px;
						line-height: 10px;
						text-shadow: 0 1px 3px black;
						background: {color};
						border-radius: 3px;
						font-weight: 500;
						padding: 3px 5px;
						color: #FFF;
						font-family: 'Roboto', 'Inconsolata', 'Whitney', sans-serif;
						width: fit-content;
					}

					.tagID.before {
						margin-left: -4px;
						margin-right: 6px;
					}

					.tagID.after {
						margin-left: 4px;
						margin-right: 4px;
					}
		
					.${MessageClasses.groupStart.split(" ")[0]}.${
					MessageClasses.cozyMessage.split(" ")[0]
				} h2.${MessageClasses.header.split(" ")[0]},
					.${MessageClasses.groupStart.split(" ")[0]}.${
					MessageClasses.cozyMessage.split(" ")[0]
				} h2.${MessageClasses.header.split(" ")[0]} .headerText-2z4IhQ {
						display: flex;
						align-items: center;
					}

					.${MessageClasses.compact.split(" ")[0]} .tagID {
						padding: 2px 3px;
					}

					#app-mount :-webkit-any(.tooltip-2QfLtc, .bd-tooltip, .toolbar-2bjZV7, .bubble-3we2d) {
						white-space: break-spaces;
					}
				`;
			}

			/* Methods */

			onStart() {
				this.settings = this.loadSettings(this.default);
				this.reinjectCSS();
				this.promises.restore();
				this.patchMessages(this.promises.state);
				Toasts.info(`${this.name} ${this.version} has started!`, {
					timeout: 2e3,
				});
			}

			onStop() {
				PluginUtilities.removeStyle(this.short);
				this.promises.cancel();
				// this.clearTags();
				Patcher.unpatchAll();
				this.updateMessages();
				Toasts.info(`${this.name} ${this.version} has stopped!`, {
					timeout: 2e3,
				});
			}

			onHeader() {
				const headers = document.querySelectorAll(
					`.${MessageClasses.header.split(" ")[0]}`
				);
				if (!headers.length) return;
				// @ts-ignore
				for (const header of headers) this.processNode(header);
			}

			patchMessages(state) {
				if (state.cancelled || !MessageHeader) return;
				Patcher.after(MessageHeader, "default", (that, [props], value) => {
					const {
						message: { id, author },
						subscribeToGroupId,
					} = props;
					if (id !== subscribeToGroupId) return value;

					const children = this.getProps(
						value,
						"props.username.props.children.1.props.children"
					);
					if (!children || !Array.isArray(children)) return value;

					const { extraClass, pos } = this.getPos(this.settings);
					const date = author.createdAt
						.toString()
						.replace(/\([\w\d].+\)/g, "")
						.split(" ");
					const gmt = date.pop();
					const tag = React.createElement(WrapBoundary(Tag), {
						id: author.id,
						key: `ChatUserID-${author.id}`,
						text: `${date.join(" ").trim()}\n${gmt.trim()}`,
						hover: this.settings.hoverTip,
						classes: [extraClass],
						onDoubleClick: (e) => this.double(e, author),
					});

					const fn = (child) =>
						child && child.key && child.key.startsWith("ChatUserID");
					if (!children.find(fn))
						children.splice(pos === "beforebegin" ? 0 : 2, 0, tag);

					return value;
				});
				this.updateMessages();
			}

			updateMessages() {
				const messages = document.querySelectorAll(
					`.${MessageClasses.message}`
				);
				if (!messages.length) return;
				for (let i = 0, len = messages.length; i < len; i++)
					ReactTools.getOwnerInstance(messages[i]).forceUpdate();
			}

			reinjectCSS() {
				PluginUtilities.removeStyle(this.short);
				PluginUtilities.addStyle(
					this.short,
					this.css.replace(/{color}/, this.settings.color)
				);
			}

			double(e, author) {
				try {
					clipboard.copy(author.id);
					Toasts.info("Successfully copied!", { timeout: 2e3 });
				} catch (err) {
					error(err);
					Toasts.error("Failed to copy! See console for error(s)!", {
						timeout: 2e3,
					});
				}
				if (e.target) e.target.blur();
				setImmediate(() => window.getSelection().removeAllRanges());
			}

			createTag(id) {
				const div = DOMTools.parseHTML(`<span class="tagID">${id}</span>`);
				return div;
			}

			processNode(node) {
				if (node.querySelector(".tagID")) return;
				const instance = ReactTools.getReactInstance(node);
				if (!instance) return;
				const props = this.getProps(
					instance,
					"memoizedProps.children.1.props.children.props.children.0.props"
				);
				if (!props || !this.getProps(props, "message")) return;
				const {
					message: { author },
				} = props;
				const tag = this.createTag(author.id);
				const username = node.querySelector(
					`.${MessageClasses.username.split(" ")[0]}`
				);
				DOMTools.on(tag, `dblclick.${this.short}`, (e) =>
					this.double(e, author)
				);
				const { extraClass, pos } = this.getPos(this.settings);
				tag.classList.add(extraClass);
				username.insertAdjacentElement(pos, tag);
			}

			getPos(settings) {
				const value = !settings.tagPosition;
				return {
					extraClass: value ? "before" : "after",
					pos: value ? "beforebegin" : "afterend",
				};
			}

			removeTag(node) {
				if (!node || !node.querySelector(".tagID")) return;
				const target = node.querySelector(".tagID");
				target.remove();
			}

			clearTags() {
				// @ts-ignore
				for (const node of document.querySelectorAll(
					`.${MessageClasses.groupStart.split(" ")[0]}`
				))
					this.removeTag(node);
			}

			/**
			 * @name safelyGetNestedProps
			 * @author Zerebos
			 */
			getProps(obj, path) {
				return path
					.split(/\s?\.\s?/)
					.reduce((obj, prop) => obj && obj[prop], obj);
			}

			/* Observer */
			// observer({ addedNodes }) {
			// 	if (!addedNodes || !addedNodes.length) return;
			// 	this.onHeader();
			// }

			/* Settings Panel */

			getSettingsPanel() {
				return SettingPanel.build(
					() => this.saveSettings(this.settings),
					new SettingGroup("Plugin Settings").append(
						new ColorPicker(
							"ID Background Color",
							"Determines what color the background for the IDs will be.",
							this.settings.color ?? this.default.color,
							(i) => {
								this.settings.color = i;
								this.reinjectCSS();
							},
							{ colors: this.settings.colors, defaultColor: this.default.color }
						),
						new RadioGroup(
							"Tag Placement",
							"Decides whether the tag is placed before the username, or after it.",
							this.settings.tagPosition || 0,
							options,
							(i) => {
								this.settings.tagPosition = i;
								// this.clearTags();
								// this.onHeader();
								this.updateMessages();
							}
						),
						new Switch(
							"Hover Tooltip",
							"Decides whether or not the account creation date tooltip is displayed.",
							this.settings.hoverTip,
							(i) => {
								this.settings.hoverTip = i;
								this.updateMessages();
							}
						)
					)
				);
			}

			/* Setters */
			// @ts-ignore
			set css(styles = "") {
				// @ts-ignore
				return (this._css = styles.split(/\s+/g).join(" ").trim());
			}

			/* Getters */

			get [Symbol.toStringTag]() {
				return "Plugin";
			}

			get css() {
				return this._css;
			}

			/* eslint-disable no-undef */

			get name() {
				return config.info.name;
			}

			get short() {
				let string = "";

				for (let i = 0, len = config.info.name.length; i < len; i++) {
					const char = config.info.name[i];
					if (char === char.toUpperCase()) string += char;
				}

				return string;
			}

			get author() {
				return config.info.authors.map((author) => author.name).join(", ");
			}

			get version() {
				return config.info.version;
			}

			get description() {
				return config.info.description;
			}
		};
	};

	/* Finalize */

	return !globalThis.ZeresPluginLibrary
		? class {
				#config;

				constructor() {
					this.#config = config;
				}

				getName() {
					return this.name.replace(/\s+/g, "");
				}

				getAuthor() {
					return this.author;
				}

				getVersion() {
					return this.version;
				}

				getDescription() {
					return this.description;
				}

				stop() {
					log("Stopped!");
				}

				load() {
					// @ts-ignore
					const {
						BdApi,
						BdApi: {
							React: { createElement },
						},
					} = window;
					const title = "Library Missing";
					const TextElement = BdApi.findModuleByDisplayName("LegacyText");
					const children = [];
					if (!TextElement) {
						children.push(
							createElement("span", {
								children: [
									`The library plugin needed for ${config.info.name} is missing.`,
								],
							}),
							createElement("br", {}),
							createElement("a", {
								target: "_blank",
								href: "https://betterdiscord.app/Download?id=9",
								children: ["Click here to download the library!"],
							})
						);
						return BdApi.alert(title, createElement("span", { children }));
					}
					children.push(
						createElement(TextElement, {
							color: TextElement.Colors.STANDARD,
							children: [
								`The library plugin needed for ${config.info.name} is missing.`,
							],
						}),
						createElement("br", {}),
						createElement("a", {
							target: "_blank",
							href: "https://betterdiscord.app/Download?id=9",
							children: ["Click here to download the library!"],
						})
					);
					if (!BdApi.showConfirmationModal) return BdApi.alert(title, children);
					BdApi.showConfirmationModal(
						title,
						[
							createElement(TextElement, {
								color: TextElement.Colors.STANDARD,
								children: [
									`The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`,
								],
							}),
						],
						{
							danger: false,
							confirmText: "Download Now",
							cancelText: "Cancel",
							onConfirm: () => {
								// @ts-ignore
								require("request").get(
									"https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js",
									async (error, response, body) => {
										// @ts-ignore
										if (error)
											return require("electron").shell.openExternal(
												"https://betterdiscord.app/Download?id=9"
											);
										// @ts-ignore
										await new Promise((r) =>
											require("fs").writeFile(
												require("path").join(
													window.ContentManager.pluginsFolder,
													"0PluginLibrary.plugin.js"
												),
												body,
												r
											)
										);
									}
								);
							},
						}
					);
				}

				start() {
					log("Started!");
				}

				/* Getters */

				get [Symbol.toStringTag]() {
					return "Plugin";
				}

				get name() {
					return config.info.name;
				}

				get short() {
					let string = "";

					for (let i = 0, len = config.info.name.length; i < len; i++) {
						const char = config.info.name[i];
						if (char === char.toUpperCase()) string += char;
					}

					return string;
				}

				get author() {
					return config.info.authors.map((author) => author.name).join(", ");
				}

				get version() {
					return config.info.version;
				}

				get description() {
					return config.info.description;
				}
		  }
		: buildPlugin(globalThis.ZeresPluginLibrary.buildPlugin(config));
})();

module.exports = CRH;