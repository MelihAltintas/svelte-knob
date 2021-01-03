(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Knob = factory());
}(this, (function () { 'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\Knob.svelte generated by Svelte v3.31.1 */

    function add_css() {
    	var style = element("style");
    	style.id = "svelte-lrqbdu-style";
    	style.textContent = "@keyframes svelte-lrqbdu-dash-frame{100%{stroke-dashoffset:0}}.knob-control__range.svelte-lrqbdu{fill:none;transition:stroke .1s ease-in}.knob-control__value.svelte-lrqbdu{animation-name:svelte-lrqbdu-dash-frame;animation-fill-mode:forwards;fill:none}.knob-control__text-display.svelte-lrqbdu{font-size:1.3rem;text-align:center}";
    	append(document.head, style);
    }

    // (15:8) {#if showValue}
    function create_if_block(ctx) {
    	let path;
    	let text_1;
    	let t;

    	return {
    		c() {
    			path = svg_element("path");
    			text_1 = svg_element("text");
    			t = text(/*valueDisplay*/ ctx[12]);
    			attr(path, "d", /*valuePath*/ ctx[11]);
    			attr(path, "stroke-width", /*strokeWidth*/ ctx[4]);
    			attr(path, "stroke", /*primaryColor*/ ctx[1]);
    			attr(path, "data-dash", length);
    			attr(path, "style", /*dashStyle*/ ctx[7]);
    			attr(path, "class", "knob-control__value svelte-lrqbdu");
    			attr(text_1, "x", "50");
    			attr(text_1, "y", "57");
    			attr(text_1, "text-anchor", "middle");
    			attr(text_1, "fill", /*textColor*/ ctx[3]);
    			attr(text_1, "class", "knob-control__text-display svelte-lrqbdu");
    		},
    		m(target, anchor) {
    			insert(target, path, anchor);
    			/*path_binding*/ ctx[40](path);
    			insert(target, text_1, anchor);
    			append(text_1, t);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*valuePath*/ 2048) {
    				attr(path, "d", /*valuePath*/ ctx[11]);
    			}

    			if (dirty[0] & /*strokeWidth*/ 16) {
    				attr(path, "stroke-width", /*strokeWidth*/ ctx[4]);
    			}

    			if (dirty[0] & /*primaryColor*/ 2) {
    				attr(path, "stroke", /*primaryColor*/ ctx[1]);
    			}

    			if (dirty[0] & /*dashStyle*/ 128) {
    				attr(path, "style", /*dashStyle*/ ctx[7]);
    			}

    			if (dirty[0] & /*valueDisplay*/ 4096) set_data(t, /*valueDisplay*/ ctx[12]);

    			if (dirty[0] & /*textColor*/ 8) {
    				attr(text_1, "fill", /*textColor*/ ctx[3]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(path);
    			/*path_binding*/ ctx[40](null);
    			if (detaching) detach(text_1);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let svg;
    	let path;
    	let mounted;
    	let dispose;
    	let if_block = /*showValue*/ ctx[0] && create_if_block(ctx);

    	return {
    		c() {
    			div = element("div");
    			svg = svg_element("svg");
    			path = svg_element("path");
    			if (if_block) if_block.c();
    			attr(path, "d", /*rangePath*/ ctx[10]);
    			attr(path, "stroke-width", /*strokeWidth*/ ctx[4]);
    			attr(path, "stroke", /*secondaryColor*/ ctx[2]);
    			attr(path, "class", "knob-control__range svelte-lrqbdu");
    			attr(svg, "width", /*computedSize*/ ctx[9]);
    			attr(svg, "height", /*computedSize*/ ctx[9]);
    			attr(svg, "viewBox", "0 0 100 100");
    			attr(div, "class", "knob-control");
    			attr(div, "style", /*style*/ ctx[8]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, svg);
    			append(svg, path);
    			if (if_block) if_block.m(svg, null);
    			/*div_binding*/ ctx[41](div);

    			if (!mounted) {
    				dispose = [
    					listen(svg, "click", /*onClick*/ ctx[13]),
    					listen(svg, "mousedown", /*onMouseDown*/ ctx[14]),
    					listen(svg, "mouseup", /*onMouseUp*/ ctx[15]),
    					listen(svg, "touchstart", /*onTouchStart*/ ctx[16]),
    					listen(svg, "touchend", /*onTouchEnd*/ ctx[17])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*rangePath*/ 1024) {
    				attr(path, "d", /*rangePath*/ ctx[10]);
    			}

    			if (dirty[0] & /*strokeWidth*/ 16) {
    				attr(path, "stroke-width", /*strokeWidth*/ ctx[4]);
    			}

    			if (dirty[0] & /*secondaryColor*/ 4) {
    				attr(path, "stroke", /*secondaryColor*/ ctx[2]);
    			}

    			if (/*showValue*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(svg, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty[0] & /*computedSize*/ 512) {
    				attr(svg, "width", /*computedSize*/ ctx[9]);
    			}

    			if (dirty[0] & /*computedSize*/ 512) {
    				attr(svg, "height", /*computedSize*/ ctx[9]);
    			}

    			if (dirty[0] & /*style*/ 256) {
    				attr(div, "style", /*style*/ ctx[8]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    			/*div_binding*/ ctx[41](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    const RADIUS = 40;
    const MID_X = 50;
    const MID_Y = 50;
    let length = 0;

    function mapRange(x, inMin, inMax, outMin, outMax) {
    	return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    function instance($$self, $$props, $$invalidate) {
    	let dashStyle;
    	let style;
    	let computedSize;
    	let rangePath;
    	let valuePath;
    	let zeroRadians;
    	let valueRadians;
    	let minX;
    	let minY;
    	let maxX;
    	let maxY;
    	let zeroX;
    	let zeroY;
    	let valueX;
    	let valueY;
    	let largeArc;
    	let sweep;
    	let valueDisplay;
    	const MIN_RADIANS = 4 * Math.PI / 3;
    	const MAX_RADIANS = -Math.PI / 3;
    	let pathValue;
    	let knob;
    	let animatedValue = 0;
    	let interval = null;

    	let { animation = {
    		animated: false,
    		animateValue: false,
    		animationDuration: 2000,
    		animationFunction: "ease-in-out"
    	} } = $$props;

    	let { value = 0 } = $$props;
    	let { max = 100 } = $$props;
    	let { min = 0 } = $$props;
    	let { showValue = true } = $$props;
    	let { disabled = false } = $$props;
    	let { step = 1 } = $$props;
    	let { size = 100 } = $$props;
    	let { responsive = false } = $$props;
    	let { primaryColor = "#409eff" } = $$props;
    	let { secondaryColor = "#dcdfe6" } = $$props;
    	let { textColor = "#000000" } = $$props;
    	let { strokeWidth = 17 } = $$props;
    	let { valueDisplayFunction = v => v } = $$props;

    	onMount(async () => {
    		dashLength();
    		clearInterval(interval);
    		console.log(min, max, value);
    		interval = null;

    		if (animation.animateValue) {
    			interval = setInterval(
    				() => {
    					if (animatedValue < value) {
    						$$invalidate(27, animatedValue += 1);
    					} else {
    						clearInterval(interval);
    						interval = null;
    					}
    				},
    				animation.animationDuration * 1000 / value / 1000
    			);
    		}
    	});

    	function updatePosition(offsetX, offsetY) {
    		const dx = offsetX - size / 2;
    		const dy = size / 2 - offsetY;
    		const angle = Math.atan2(dy, dx);
    		let mappedValue;
    		const start = -Math.PI / 2 - Math.PI / 6;

    		if (angle > MAX_RADIANS) {
    			mappedValue = mapRange(angle, MIN_RADIANS, MAX_RADIANS, min, max);
    		} else if (angle < start) {
    			mappedValue = mapRange(angle + 2 * Math.PI, MIN_RADIANS, MAX_RADIANS, min, max);
    		} else {
    			return;
    		}

    		console.log(mappedValue);
    		$$invalidate(18, value = Math.round((mappedValue - min) / step) * step + min);
    	}

    	

    	function onClick(e) {
    		if (!disabled) {
    			updatePosition(e.offsetX, e.offsetY);
    		}
    	}

    	

    	function onMouseDown(e) {
    		if (!disabled) {
    			e.preventDefault();
    			window.addEventListener("mousemove", onMouseMove);
    			window.addEventListener("mouseup", onMouseUp);
    		}
    	}

    	

    	function onMouseUp(e) {
    		if (!disabled) {
    			e.preventDefault();
    			window.removeEventListener("mousemove", onMouseMove);
    			window.removeEventListener("mouseup", onMouseUp);
    		}
    	}

    	

    	function onTouchStart(e) {
    		if (!disabled) {
    			e.preventDefault();
    			window.addEventListener("touchmove", onTouchMove);
    			window.addEventListener("touchend", onTouchEnd);
    		}
    	}

    	

    	function onTouchEnd(e) {
    		if (!disabled) {
    			e.preventDefault();
    			window.removeEventListener("touchmove", onTouchMove);
    			window.removeEventListener("touchend", onTouchEnd);
    		}
    	}

    	

    	function onMouseMove(e) {
    		if (!disabled) {
    			e.preventDefault();
    			updatePosition(e.offsetX, e.offsetY);
    		}
    	}

    	

    	function onTouchMove(e) {
    		if (!disabled && e.touches.length == 1) {
    			const boundingClientRect = knob.getBoundingClientRect();
    			const touch = e.targetTouches.item(0);
    			const offsetX = touch.clientX - boundingClientRect.left;
    			const offsetY = touch.clientY - boundingClientRect.top;
    			updatePosition(offsetX, offsetY);
    		}
    	}

    	

    	function dashLength() {
    		console.log(pathValue);
    		let element = pathValue;
    		let length = element.getTotalLength();

    		if (animation.animated) {
    			element.style.animationDuration = animation.animationDuration / 1000 + "s";
    			element.style.animationFunction = animation.animationFunction;
    		}

    		element.dataset.dash = length;
    		length = length;
    	}

    	
    	

    	function path_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			pathValue = $$value;
    			$$invalidate(5, pathValue);
    		});
    	}

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			knob = $$value;
    			$$invalidate(6, knob);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("animation" in $$props) $$invalidate(19, animation = $$props.animation);
    		if ("value" in $$props) $$invalidate(18, value = $$props.value);
    		if ("max" in $$props) $$invalidate(20, max = $$props.max);
    		if ("min" in $$props) $$invalidate(21, min = $$props.min);
    		if ("showValue" in $$props) $$invalidate(0, showValue = $$props.showValue);
    		if ("disabled" in $$props) $$invalidate(22, disabled = $$props.disabled);
    		if ("step" in $$props) $$invalidate(23, step = $$props.step);
    		if ("size" in $$props) $$invalidate(24, size = $$props.size);
    		if ("responsive" in $$props) $$invalidate(25, responsive = $$props.responsive);
    		if ("primaryColor" in $$props) $$invalidate(1, primaryColor = $$props.primaryColor);
    		if ("secondaryColor" in $$props) $$invalidate(2, secondaryColor = $$props.secondaryColor);
    		if ("textColor" in $$props) $$invalidate(3, textColor = $$props.textColor);
    		if ("strokeWidth" in $$props) $$invalidate(4, strokeWidth = $$props.strokeWidth);
    		if ("valueDisplayFunction" in $$props) $$invalidate(26, valueDisplayFunction = $$props.valueDisplayFunction);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*responsive, size*/ 50331648) {
    			 $$invalidate(8, style = "height:" + (responsive ? size + "%" : size - 5 + "px"));
    		}

    		if ($$self.$$.dirty[0] & /*responsive, size*/ 50331648) {
    			 $$invalidate(9, computedSize = responsive ? size + "%" : size);
    		}

    		if ($$self.$$.dirty[0] & /*minX, minY, maxX*/ 1879048192 | $$self.$$.dirty[1] & /*maxY*/ 1) {
    			 $$invalidate(10, rangePath = `M ${minX} ${minY} A ${RADIUS} ${RADIUS} 0 1 1 ${maxX} ${maxY}`);
    		}

    		if ($$self.$$.dirty[0] & /*min, max*/ 3145728) {
    			 $$invalidate(38, zeroRadians = min > 0 && max > 0
    			? mapRange(min, min, max, MIN_RADIANS, MAX_RADIANS)
    			: mapRange(0, min, max, MIN_RADIANS, MAX_RADIANS));
    		}

    		if ($$self.$$.dirty[1] & /*zeroRadians*/ 128) {
    			 $$invalidate(32, zeroX = MID_X + Math.cos(zeroRadians) * RADIUS);
    		}

    		if ($$self.$$.dirty[1] & /*zeroRadians*/ 128) {
    			 $$invalidate(33, zeroY = MID_Y - Math.sin(zeroRadians) * RADIUS);
    		}

    		if ($$self.$$.dirty[0] & /*value, min, max*/ 3407872) {
    			 $$invalidate(39, valueRadians = mapRange(value, min, max, MIN_RADIANS, MAX_RADIANS));
    		}

    		if ($$self.$$.dirty[1] & /*zeroRadians, valueRadians*/ 384) {
    			 $$invalidate(34, largeArc = Math.abs(zeroRadians - valueRadians) < Math.PI ? 0 : 1);
    		}

    		if ($$self.$$.dirty[1] & /*valueRadians, zeroRadians*/ 384) {
    			 $$invalidate(35, sweep = valueRadians > zeroRadians ? 0 : 1);
    		}

    		if ($$self.$$.dirty[1] & /*valueRadians*/ 256) {
    			 $$invalidate(36, valueX = MID_X + Math.cos(valueRadians) * RADIUS);
    		}

    		if ($$self.$$.dirty[1] & /*valueRadians*/ 256) {
    			 $$invalidate(37, valueY = MID_Y - Math.sin(valueRadians) * RADIUS);
    		}

    		if ($$self.$$.dirty[1] & /*zeroX, zeroY, largeArc, sweep, valueX, valueY*/ 126) {
    			 $$invalidate(11, valuePath = `M ${zeroX} ${zeroY} A ${RADIUS} ${RADIUS} 0 ${largeArc} ${sweep} ${valueX} ${valueY}`);
    		}

    		if ($$self.$$.dirty[0] & /*animation, valueDisplayFunction, animatedValue, value*/ 202113024) {
    			 $$invalidate(12, valueDisplay = animation.animateValue
    			? valueDisplayFunction(animatedValue)
    			: valueDisplayFunction(value));
    		}
    	};

    	 $$invalidate(7, dashStyle = {
    		strokeDasharray: length,
    		strokeDashoffset: length
    	});

    	 $$invalidate(28, minX = MID_X + Math.cos(MIN_RADIANS) * RADIUS);
    	 $$invalidate(29, minY = MID_Y - Math.sin(MIN_RADIANS) * RADIUS);
    	 $$invalidate(30, maxX = MID_X + Math.cos(MAX_RADIANS) * RADIUS);
    	 $$invalidate(31, maxY = MID_Y - Math.sin(MAX_RADIANS) * RADIUS);

    	return [
    		showValue,
    		primaryColor,
    		secondaryColor,
    		textColor,
    		strokeWidth,
    		pathValue,
    		knob,
    		dashStyle,
    		style,
    		computedSize,
    		rangePath,
    		valuePath,
    		valueDisplay,
    		onClick,
    		onMouseDown,
    		onMouseUp,
    		onTouchStart,
    		onTouchEnd,
    		value,
    		animation,
    		max,
    		min,
    		disabled,
    		step,
    		size,
    		responsive,
    		valueDisplayFunction,
    		animatedValue,
    		minX,
    		minY,
    		maxX,
    		maxY,
    		zeroX,
    		zeroY,
    		largeArc,
    		sweep,
    		valueX,
    		valueY,
    		zeroRadians,
    		valueRadians,
    		path_binding,
    		div_binding
    	];
    }

    class Knob extends SvelteComponent {
    	constructor(options) {
    		super();
    		if (!document.getElementById("svelte-lrqbdu-style")) add_css();

    		init(
    			this,
    			options,
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				animation: 19,
    				value: 18,
    				max: 20,
    				min: 21,
    				showValue: 0,
    				disabled: 22,
    				step: 23,
    				size: 24,
    				responsive: 25,
    				primaryColor: 1,
    				secondaryColor: 2,
    				textColor: 3,
    				strokeWidth: 4,
    				valueDisplayFunction: 26
    			},
    			[-1, -1]
    		);
    	}
    }

    return Knob;

})));
