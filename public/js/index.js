import { COLORS, PRIORITY_MODAL } from './constant.js';
import { uuid, query, prevent } from './util.js';

// addons
import canvas from './addon/canvas.js';
import locale from './addon/locale.js';
import ripple from './addon/ripple.js';
// import gamepad from './addon/gamepad.js';

let node;
let state = {
	color: 54,
	color_list: [54, 2, 17, 27, 37, 12],
	radius: 14,
	index: 0,
	device: null,
	device_fallback: null,
	device_list: {
		mouse: false,
		touch: false,
		pen: false,
		gamepad: false
	},
	pencil_list: [
		'pen',
		'marker',
		'eraser'
	],
	pencil: 'pen',
	timestamp: null,
	modal: null,
	tab: null,
	caption: null,
	option: {
		view_mode: false
	},
	history: [],
	redo_history: []
};

window.addEventListener('load', init);

function init() {

	console.log('%cOutline', 'font-size: 24px; font-weight: 600;');
	console.log('%cDraw with friends together.\n', 'font-size: 14px;');
	console.log('Found a bug? Tell us:', 'https://github.com/typable/outline/issues/new/choose');

	canvas.init();
	locale.init('en');
	locale.load('./asset/lang', ['en', 'de'], function() {
		if('localStorage' in window) {
			let user_lang = localStorage.getItem('outline.user.lang');
			if(user_lang) {
				locale.change(user_lang);
				update_language_list();
			}
		}
	});
	ripple.init();

	node = query({
		wrapper: '.wrapper',
		controls: '.controls',
		modal_list: { query: '.modal', all: true },
		tab_list: { query: '.tab', all: true },
		header: '.header-list',
		hotbar: '.hotbar',
		hotbar_list: { query: '.hotbar .color', all: true },
		modal_color_list: { query: '.colors-modal .color', all: true },
		language_list: { query: '.more-modal .language-tab .item[data-event="change.language"]', all: true },
		device_list: { query: '.more-modal .device-tab .item[data-event="change.device"]', all: true },
		pencil_list: { query: '.pencil-modal .item[data-event="change.pencil"]', all: true },
		modal_event_list: { query: '[data-event*=".modal"]', all: true },
		tab_event_list: { query: '[data-event*=".tab"]', all: true },
		tool_list: { query: '.tool', all: true },
		action_list: { query: '.action', all: true },
		notification: '.notification',
		scale_input: 'input.scale[type="range"]',
		clear: 'button.btn-apply[data-event="clear"]',
		pencil_tool: '.tool-item[data-code="pencil"]',
		option_event_fullscreen: '[data-event="toggle.fullscreen"]',
		option_event_view_mode: '[data-event="toggle.view-mode"]',
		undo_tool: '[data-lang="action.undo"]',
		redo_tool: '[data-lang="action.redo"]',
		colors_modal: '.colors-modal',
		mainbar: '.mainbar',
		sidebar: '.sidebar',
		edit_mode: '[data-event="close.view-mode"]',
		content: '.modal .content',
		caption_list: { query: '[data-event="open.content"]' , all: true },
		content_list: { query: '.content-item' , all: true }
	});

	fill_hotbar_list();
	fill_modal_color_list();

	bind_events();

	node.wrapper.animate([
		{ opacity: 1 },
		{ opacity: 0, pointerEvents: 'none' }
	], {
		delay: 100,
		duration: 500,
		fill: 'both'
	});
	node.hotbar.animate([
		{ opacity: 0, bottom: '-10px' },
		{ opacity: 1 }
	], {
		delay: 600,
		easing: 'ease-out',
		duration: 250,
		fill: 'both'
	});
}

function bind_events() {
	window.onerror = function(error, url, line) {
		fetch('https://server.typable.dev/log', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				date: new Date(),
				error: {
					message: error,
					file: url,
					line: line
				}
			})
		});
	}
	document.addEventListener('dragstart', prevent);
	document.addEventListener('contextmenu', prevent);
	document.addEventListener('pointerdown', on_pointerdown);
	document.addEventListener('pointermove', on_pointermove);
	document.addEventListener('pointerup', on_pointerup);
	document.addEventListener('pointerout', on_pointerout);
	document.addEventListener('keydown', on_keydown);
	document.addEventListener('wheel', on_wheel);
	document.addEventListener('wheel', function(event) {
		if(event.ctrlKey) {
			prevent(event);
		}
	}, { passive: false });
	document.addEventListener('touchmove', function(event) {
		if(event.target !== node.scale_input && event.target !== node.colors_modal && !node.modal_color_list.includes(event.target) && event.target !== node.content) {
			event.preventDefault();
		}
	}, { passive: false });

	for(let item of node.language_list) {
		item.addEventListener('click', function(event) {
			let code = item.dataset.code;
			locale.change(code);
			update_language_list();
		});
	}
	for(let item of node.device_list) {
		item.addEventListener('click', function(event) {
			let code = item.dataset.code;
			if(state.device_list[code]) {
				state.device = code;
				update_device_list();
			}
		});
	}
	for(let item of node.pencil_list) {
		item.addEventListener('click', function(event) {
			state.pencil = item.dataset.code;
			update_pencil_list();
			state.modal = null;
			update_modal_list();
		});
	}
	for(let item of node.modal_event_list) {
		item.addEventListener('click', function(event) {
			let code = item.dataset.code;
			let match = /^(toggle|open|close).modal$/.exec(item.dataset.event);
			if(match) {
				if(!item.classList.contains('inactive')) {
					switch(match[1]) {
						case 'toggle':
							if(code) {
								state.modal = state.modal !== code ? code : null;
								update_modal_list();
							}
							break;
						case 'open':
							if(code && state.modal !== code) {
								state.modal = code;
								update_modal_list();
							}
							break;
						case 'close':
							if(state.modal !== null) {
								state.modal = null;
								update_modal_list();
							}
							break;
						default:
							break;
					}
				}
			}
		});
	}
	for(let item of node.tab_event_list) {
		item.addEventListener('click', function(event) {
			let code = item.dataset.code;
			let match = /^(open|close).tab/.exec(item.dataset.event);
			if(match) {
				switch(match[1]) {
					case 'open':
						if(code && state.tab !== code) {
							state.tab = code;
							update_tab_list();
						}
						break;
					case 'close':
						if(state.tab !== null) {
							state.tab = null;
							update_tab_list();
						}
						break;
					default:
						break;
				}
			}
		});
	}
	node.scale_input.addEventListener('input', function(event) {
		state.radius = parseInt(node.scale_input.value);
		state.point = {
			x: parseInt(window.innerWidth / 2),
			y: parseInt(window.innerHeight / 2)
		};
		canvas.draw_cursor(state);
	});
	node.clear.addEventListener('click', function(event) {
		canvas.clear(state);
		update_undo_and_redo();
		show_notification('notification.clear');
		state.modal = null;
		update_modal_list();
	});
	node.option_event_fullscreen.addEventListener('click', function(event) {
		if(!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
		}
		else if(document.exitFullscreen) {
			document.exitFullscreen();
		}
	});
	window.addEventListener('fullscreenchange', on_fullscreenchange);
	node.option_event_view_mode.addEventListener('click', function(event) {
		state.option.view_mode = !state.option.view_mode;
		update_view_mode_option();
	});
	node.undo_tool.addEventListener('click', function(event) {
		canvas.undo(state);
		update_undo_and_redo();
	});
	node.redo_tool.addEventListener('click', function(event) {
		canvas.redo(state);
		update_undo_and_redo();
	});
	node.edit_mode.addEventListener('click', function(event) {
		state.option.view_mode = false;
		update_view_mode_option();
	});
	for(let item of node.caption_list) {
		item.addEventListener('click', function(event) {
			state.caption = item.dataset.code;
			update_caption_list();
		});
	}

	window.addEventListener('beforeunload', function(event) {
		// ...
	});
}

function update_language_list() {
	let lang = locale.get_current();
	for(let item of node.language_list) {
		let code = item.dataset.code;
		item.classList[code === lang ? 'add' : 'remove']('active');
	}
}

function update_device_list() {
	canvas.get_canvas().style.cursor = state.device === 'mouse' ? 'none' : '';
	for(let item of node.device_list) {
		let code = item.dataset.code;
		item.classList[code === state.device ? 'add' : 'remove']('active');
		item.classList[state.device_list[code] ? 'remove' : 'add']('inactive');
	}
}

function update_pencil_list() {
	for(let item of node.pencil_list) {
		let code = item.dataset.code;
		item.classList[code === state.pencil ? 'add' : 'remove']('active');
		if(code === state.pencil) {
			node.pencil_tool.querySelector('i.ico').innerHTML = item.querySelector('i.ico').innerHTML;
		}
	}
}

function update_hotbar() {
	for(let item of node.hotbar_list) {
		item.classList[node.hotbar_list[state.index] === item ? 'add' : 'remove']('active');
	}
}

function update_focus(bool) {
	for(let item of node.hotbar_list) {
		item.style.pointerEvents = bool ? '' : 'none';
	}
	for(let item of node.tool_list) {
		item.style.pointerEvents = bool ? '' : 'none';
	}
	for(let item of node.action_list) {
		item.style.pointerEvents = bool ? '' : 'none';
	}
}

function update_modal_list() {
	for(let item of node.modal_list) {
		item.classList.add('hidden');
	}
	for(let item of node.modal_event_list) {
		item.classList.remove('active');
	}
	state.tab = null;
	update_tab_list();
	state.caption = 'controls';
	update_caption_list();
	if(state.modal) {
		canvas.on_release(event, state, true);
		let modal = document.querySelector(`.modal.${state.modal}-modal`);
		let button = document.querySelector(`[data-event*=".modal"][data-code="${state.modal}"]`);
		if(modal) {
			modal.classList.remove('hidden');
			modal.animate([
				{ opacity: 0, marginTop: '-6px' },
				{ opacity: 1, marginTop: '0' }
			], {
				duration: 100,
				fill: 'both'
			});
		}
		if(button) {
			button.classList.add('active');
		}
	}
}

function update_tab_list() {
	for(let item of node.modal_list) {
		let main = item.querySelector('.main');
		if(main) {
			main.classList.remove('hidden');
			main.style.marginLeft = '0';
		}
	}
	for(let item of node.tab_list) {
		item.classList.add('hidden');
	}
	if(state.modal && state.tab) {
		let modal = document.querySelector(`.modal.${state.modal}-modal`);
		let tab = document.querySelector(`.${state.tab}-tab`);
		let main = modal.querySelector('.main');
		if(modal && tab && main) {
			tab.classList.remove('hidden');
			main.style.marginLeft = '-100%';
			main.classList.add('hidden');
		}
	}
}

function update_fullscreen_option() {
	let fullscreen = document.fullscreenElement;
	node.option_event_fullscreen.classList[fullscreen ? 'add' : 'remove']('active');
	node.option_event_fullscreen.querySelector('.ico').textContent = fullscreen ? 'toggle_on' : 'toggle_off';
}

function update_view_mode_option() {
	let view_mode = state.option.view_mode;
	show_notification(`notification.view-mode.${view_mode ? 'on' : 'off'}`);
	node.option_event_view_mode.classList[view_mode ? 'add' : 'remove']('active');
	node.option_event_view_mode.querySelector('.ico').textContent = view_mode ? 'toggle_on' : 'toggle_off';
	if(view_mode) {
		state.modal = null;
		state.tab = null;
		update_modal_list();
		canvas.on_release(null, state);
		canvas.clear_cursor();
		canvas.get_canvas().style.cursor = 'default';
		node.hotbar.classList.add('inactive');
		node.header.classList.add('inactive');
		node.hotbar.animate([
			{ opacity: 1 },
			{ opacity: 0, bottom: '-10px', pointerEvents: 'none' }
		], {
			easing: 'ease-out',
			duration: 250,
			fill: 'both'
		});
		node.mainbar.animate([
			{ opacity: 1, marginTop: 0 },
			{ opacity: 0, marginTop: '-60px' }
		], {
			easing: 'ease-out',
			duration: 250,
			fill: 'both'
		});
		node.sidebar.classList.remove('hidden');
		node.sidebar.animate([
			{ opacity: 0 },
			{ opacity: 1 }
		], {
			delay: 250,
			easing: 'ease-out',
			duration: 250,
			fill: 'both'
		});
	}
	else {
		canvas.get_canvas().style.cursor = 'none';
		node.hotbar.classList.remove('inactive');
		node.header.classList.remove('inactive');
		node.hotbar.animate([
			{ opacity: 0, bottom: '-10px' },
			{ opacity: 1, bottom: '30px' }
		], {
			easing: 'ease-out',
			duration: 250,
			fill: 'both'
		});
		node.mainbar.animate([
			{ opacity: 0, marginTop: '-60px' },
			{ opacity: 1, marginTop: 0 }
		], {
			easing: 'ease-out',
			duration: 250,
			fill: 'both'
		});
		node.sidebar.classList.add('hidden');
	}
}

function update_undo_and_redo() {
	node.undo_tool.classList[state.history.length > 0 ? 'remove' : 'add']('inactive');
	node.redo_tool.classList[state.redo_history.length > 0 ? 'remove' : 'add']('inactive');
}

function update_caption_list() {
	for(let item of node.caption_list) {
		let code = item.dataset.code;
		item.classList[code === state.caption ? 'add' : 'remove']('active');
	}
	for(let item of node.content_list) {
		let code = item.dataset.code;
		item.classList[code === state.caption ? 'remove' : 'add']('hidden');
	}
}

function on_pointerdown(event) {
	// detect touch
	if(!state.device_list.touch && event.pointerType === 'touch') {
		state.device_list.touch = true;
		if(state.device) {
			show_notification('notification.input-device.touch.add');
		}
		else {
			state.device = 'touch';
			state.device_fallback = 'touch';
		}
		update_device_list();
	}
	// detect pen
	if(!state.device_list.pen && event.pointerType === 'pen') {
		state.device_list.pen = true;
		show_notification('notification.input-device.pencil.add');
		if(!state.device) {
			state.device = 'pen';
			state.device_fallback = 'pen';
		}
		update_device_list();
	}
	// drawing
	if(!state.option.view_mode && state.device === event.pointerType) {
		if(event.target === canvas.get_canvas()) {
			if(!PRIORITY_MODAL.includes(state.modal)) {
				update_focus(false);
				canvas.on_press(event, state);
				update_undo_and_redo();
				state.point = {
					x: event.layerX,
					y: event.layerY
				};
				canvas.draw_cursor(state);
			}
		}
	}
}

function on_pointermove(event) {
	// detect mouse
	if(!state.device_list.mouse && event.pointerType === 'mouse') {
		state.device_list.mouse = true;
		if(state.device) {
			show_notification('notification.input-device.mouse.add');
		}
		else {
			state.device = 'mouse';
			state.device_fallback = 'mouse';
		}
		update_device_list();
	}
	// drawing
	if(!state.option.view_mode && state.device === event.pointerType) {
		if(event.target === canvas.get_canvas()) {
			if(!PRIORITY_MODAL.includes(state.modal)) {
				canvas.on_move(event, state);
			}
			state.point = {
				x: event.layerX,
				y: event.layerY
			};
		}
		canvas.draw_cursor(state);
	}
}

function on_pointerup(event) {
	if(!state.option.view_mode && state.device === event.pointerType) {
		canvas.on_release(event, state);
		update_undo_and_redo();
		update_focus(true);
	}
}

function on_pointerout(event) {
	if(!state.option.view_mode && state.device === event.pointerType) {
		canvas.on_release(event, state);
		update_undo_and_redo();
		state.point = null;
		canvas.draw_cursor(state);
	}
}

function on_keydown(event) {
	if(event.code === 'Escape') {
		if(state.tab) {
			state.tab = null;
			update_tab_list();
			return;
		}
		if(state.modal) {
			state.modal = null;
			update_modal_list();
			return;
		}
	}
	if(!event.ctrlKey && !event.shiftKey && !event.altKey) {
		if(!state.option.view_mode) {
			if(event.code.startsWith('Digit')) {
				let i = parseInt(event.code.substr(5)) - 1;
				if(state.index !== i) {
					if(i >= 0 && i < state.color_list.length) {
						canvas.on_release(event, state);
						state.color = state.color_list[i];
						state.index = i;
						canvas.draw_cursor(state);
						update_hotbar();
					}
				}
			}
			if(event.code === 'KeyZ') {
				state.modal = state.modal !== 'colors' ? 'colors' : null;
				update_modal_list();
			}
			if(event.code === 'KeyX') {
				state.modal = state.modal !== 'scale' ? 'scale' : null;
				update_modal_list();
			}
			if(event.code === 'KeyC') {
				state.modal = state.modal !== 'pencil' ? 'pencil' : null;
				update_modal_list();
			}
			if(event.code === 'KeyV') {
				state.modal = state.modal !== 'clear' ? 'clear' : null;
				update_modal_list();
			}
			/*
			if(event.code === 'KeyB') {
				state.modal = state.modal !== 'multiplayer' ? 'multiplayer' : null;
				update_modal_list();
			}
			if(event.code === 'KeyN') {
				state.modal = state.modal !== 'account' ? 'account' : null;
				update_modal_list();
			}
			*/
			if(event.code === 'KeyM') {
				state.modal = state.modal !== 'more' ? 'more' : null;
				update_modal_list();
			}
			if(event.code === 'KeyQ') {
				canvas.on_release(event, state);
				state.pencil = state.pencil_list[0];
				canvas.draw_cursor(state);
				update_pencil_list();
			}
			if(event.code === 'KeyW') {
				canvas.on_release(event, state);
				state.pencil = state.pencil_list[1];
				canvas.draw_cursor(state);
				update_pencil_list();
			}
			if(event.code === 'KeyE') {
				canvas.on_release(event, state);
				state.pencil = state.pencil_list[2];
				canvas.draw_cursor(state);
				update_pencil_list();
			}
			if(event.code === 'KeyF') {
				if(!document.fullscreenElement) {
					document.documentElement.requestFullscreen();
				}
				else if(document.exitFullscreen) {
					document.exitFullscreen();
				}
			}
		}
		if(event.code === 'Space') {
			state.option.view_mode = !state.option.view_mode;
			update_view_mode_option();
		}
	}
	if(event.ctrlKey && !event.shiftKey && !event.altKey) {
		if(event.code === 'KeyY') {
			canvas.undo(state);
			update_undo_and_redo();
		}
		if(event.code === 'KeyZ') {
			canvas.redo(state);
			update_undo_and_redo();
		}
	}
}

function on_wheel(event) {
	if(!state.option.view_mode && state.device === 'mouse') {
		if(event.target === canvas.get_canvas()) {
			let y = event.deltaY < 0 ? 1 : -1;
			if(state.radius + y > 2 - 1 && state.radius + y < 50 + 1) {
				canvas.on_release(event, state);
				state.radius += y;
				node.scale_input.value = state.radius;
				canvas.draw_cursor(state);
			}
		}
	}
}

function on_fullscreenchange(event) {
	update_fullscreen_option();
}

function fill_hotbar_list() {
	for(let [ i, item ] of Object.entries(node.hotbar_list)) {
		if(state.color_list.length > i) {
			item.style.background = COLORS[state.color_list[i]];
			item.addEventListener('click', function(event) {
				canvas.on_release(event, state);
				state.color = state.color_list[i];
				state.index = i;
				canvas.draw_cursor(state);
				update_hotbar();
			});
			if(state.index == i) {
				item.classList.add('active');
			}
		}
	}
}

function fill_modal_color_list() {
	for(let [ i, item ] of Object.entries(node.modal_color_list)) {
		if(COLORS.length > i) {
			item.style.background = COLORS[i];
			item.addEventListener('click', function(event) {
				canvas.on_release(event, state);
				state.color = i;
				state.modal = null;
				update_modal_list();
				canvas.draw_cursor(state);
				state.index = null;
				update_hotbar();
			});
		}
	}
}

function show_notification(message) {
	let code = uuid();
	state.timestamp = code;
	let content = node.notification.querySelector('.content');
	content.textContent = locale.get()[message];
	node.notification.animate([
		{ opacity: 0 },
		{ opacity: 1 }
	], {
		duration: 200,
		fill: 'both'
	});
	setTimeout(function() {
		if(state.timestamp === code) {
			node.notification.animate([
				{ opacity: 1 },
				{ opacity: 0 }
			], {
				duration: 200,
				fill: 'both'
			});
		}
	}, 1000);
}
