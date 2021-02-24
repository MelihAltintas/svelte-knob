<div class="knob-control" style="{style}" bind:this={knob}>
    <svg width="{computedSize}" height="{computedSize}" viewBox="0 0 100 100"
        on:click="{onClick}"
        on:mousedown="{onMouseDown}"
        on:mouseup="{onMouseUp}"
        on:touchstart="{onTouchStart}"
        on:touchend="{onTouchEnd}">
        {#if !circular}
            <path
                d="{rangePath}"
                stroke-width="{strokeWidth}"
                stroke="{secondaryColor}"
                class="knob-control__range">
            </path>
        {:else}
            <circle
                cx={MID_X} cy={MID_Y}
                r={RADIUS}
                fill="none"
                stroke={secondaryColor} stroke-width={strokeWidth}
                class="knob-control__range"
            />
        {/if}

        {#if showValue && !isUndefined}
        <path
            d="{valuePath}"
            stroke-width="{strokeWidth}"
            stroke="{primaryColor}"
            bind:this={pathValue}
            data-dash="{length}"
            style="{dashStyle}"
            class="knob-control__value">
        </path>
        {/if}

        {#if showNumber}
        <text
            x="50"
            y="50"
            text-anchor="middle"
            alignment-baseline="central"
            fill="{textColor}"
            class="knob-control__text-display">
            {valueDisplay}
        </text>
        {/if}

        {#if allowUndefined}
            <circle
                cx={MID_X} cy={MID_Y}
                r={isUndefined ? RADIUS * 0.25 : RADIUS * 0.4}
                fill={isUndefined ? primaryColor : 'transparent'}
                class="knob-control__switch"
                on:click={toggleUndefined}
            />
        {/if}

    </svg>
</div>

<script>
import {
    onMount
} from 'svelte'

const RADIUS = 40;
const MID_X = 50;
const MID_Y = 50;

$: MIN_RADIANS = circular
  ? 2 * Math.PI * 3/4 // bottom
  : 2 * Math.PI * 4/6 // bottom-left-bottom
;

$: MAX_RADIANS = circular
  ? 2 * Math.PI * -1/4 // bottom
  : 2 * Math.PI * -1/6 // bottom-right-bottom
;

let pathValue;
let knob;

let length = 0;
let animatedValue = 0;
let interval = null;

export let animation = {
    animated: false,
    animateValue: false,
    animationDuration: 2000,
    animationFunction: 'ease-in-out',
}

export let circular = false;
export let modulo = false;

export let value = undefined;
export let max = 100;
export let min = 0;
export let showValue = true;
export let showNumber = true;

export let disabled = false;
export let step = 1;
export let size = 100;
export let responsive = false;
export let primaryColor = '#409eff';
export let secondaryColor = '#dcdfe6';
export let textColor = '#000000';
export let strokeWidth = 17;
export let valueDisplayFunction = (v) => v;

export let allowUndefined = false;
export let isUndefined = false;

let lastValue;

function toggleUndefined(event) {
    isUndefined = !isUndefined;
    if (isUndefined) {
        lastValue = value;
        value = undefined;
    }
    else {
        value = lastValue;
    }
    event.stopPropagation();
}

onMount(async () => {
    dashLength()
    clearInterval(interval);
  
    interval = null;
    if (animation.animateValue) {
        interval = setInterval(() => {
            if (animatedValue < value) {
                animatedValue += 1;
            } else {
                clearInterval(interval);
                interval = null;
            }
        }, (animation.animationDuration * 1000) / value / 1000);
    }

    // detect if initial value is undefined
    if (value === undefined) {
        if (allowUndefined) {
            isUndefined = true;
        }
        else {
            value = 0; // init value. or use min?
        }
    }
});

$: dashStyle = {
    strokeDasharray: length,
    strokeDashoffset: length
}

$: style = 'height:' + (responsive ? size + '%' : size - 5 + 'px');

$: computedSize = responsive ? size + '%' : size

$: rangePath = (value === undefined) ? '' : circular ? '' : `M ${minX} ${minY} A ${RADIUS} ${RADIUS} 0 1 1 ${maxX} ${maxY}`;

const rangeCircle = {
  cx: 10,
  cy: 20,
};

$: valuePath = (value === undefined) ? '' : circular
  ? `M ${valueX} ${valueY} A ${RADIUS} ${RADIUS} 0 ${largeArc} ${sweep} ${valueX2} ${valueY2}`
  : `M ${zeroX} ${zeroY} A ${RADIUS} ${RADIUS} 0 ${largeArc} ${sweep} ${valueX} ${valueY}`
;


$: zeroRadians = (min > 0 && max > 0) ?mapRange(min, min, max, MIN_RADIANS, MAX_RADIANS):mapRange(0, min, max, MIN_RADIANS, MAX_RADIANS);

$: valueRadians = mapRange(value, min, max, MIN_RADIANS, MAX_RADIANS);

$: minX = MID_X + Math.cos(MIN_RADIANS) * RADIUS;

$: minY = MID_Y - Math.sin(MIN_RADIANS) * RADIUS;

$: maxX = MID_X + Math.cos(MAX_RADIANS) * RADIUS;

$: maxY = MID_Y - Math.sin(MAX_RADIANS) * RADIUS;

$: zeroX = MID_X + Math.cos(zeroRadians) * RADIUS;

$: zeroY =MID_Y - Math.sin(zeroRadians) * RADIUS;

// TODO (allow to) use straight line? radius not arc

const circularSize = 0.2;

$: valueX = circular
  ? MID_X + Math.cos(valueRadians - circularSize) * RADIUS
  : MID_X + Math.cos(valueRadians) * RADIUS
;

$: valueY = circular
  ? MID_Y - Math.sin(valueRadians - circularSize) * RADIUS
  : MID_Y - Math.sin(valueRadians) * RADIUS
;

$: valueX2 = circular ? MID_X + Math.cos(valueRadians + circularSize) * RADIUS : 0;
$: valueY2 = circular ? MID_Y - Math.sin(valueRadians + circularSize) * RADIUS : 0;

$: largeArc = circular ? 0 : (Math.abs(zeroRadians - valueRadians) < Math.PI ? 0 : 1);

$: sweep = circular ? 0 : (valueRadians > zeroRadians ? 0 : 1);

$: valueDisplay = animation.animateValue ? valueDisplayFunction(animatedValue):valueDisplayFunction(value);

function positiveModulo(n, m) {
    return ((n % m) + m) % m;
}

let lastAngle = 0;
let valueBias = 0;
let angleBias = 0;

function updatePosition(offsetX, offsetY) {
    const dx = offsetX - size / 2;
    const dy = size / 2 - offsetY;
    const angle = Math.atan2(dy, dx);

    let mappedValue;

    const start = -Math.PI / 2 - Math.PI / 6;

    if (circular) {
        // detect overflow
        const angleDiff = angle - lastAngle;
        if (angleDiff > Math.PI) {
            valueBias = valueBias + max; // TODO verify: assert min == 0
            angleBias = angleBias - 2*Math.PI - (MAX_RADIANS - MIN_RADIANS);
        }
        else if (angleDiff < (-1 * Math.PI)) {
            valueBias = valueBias - max; // TODO verify: assert min == 0
            angleBias = angleBias + 2*Math.PI + (MAX_RADIANS - MIN_RADIANS);
        }

        mappedValue = mapRange(angleBias + angle + 2 * Math.PI, MIN_RADIANS, MAX_RADIANS, min, max);

        // TODO avoid some calculation if step is disabled
        value = valueBias + Math.round((mappedValue - min) / step) * step + min;
        //value = Math.round((mappedValue - min) / step) * step + min;

        if (modulo !== false) {
            value = positiveModulo(value, modulo);
        }

        lastAngle = angle;
        isUndefined = false;
        return;
    }

    if (angle > MAX_RADIANS) {
        mappedValue = mapRange(angle, MIN_RADIANS, MAX_RADIANS, min, max);
    } else if (angle < start) {
        mappedValue = mapRange(angle + 2 * Math.PI, MIN_RADIANS, MAX_RADIANS, min, max);
    } else {
       
        lastAngle = angle;
        return;
    }
    

    value = Math.round((mappedValue - min) / step) * step + min;
    isUndefined = false;
    lastAngle = angle;
};

function onClick(e) {
 
    if (!disabled) {
   
        updatePosition(e.offsetX, e.offsetY);
    }
};

function onMouseDown(e) {
    if (!disabled) {
        e.preventDefault();
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }
};

function onMouseUp(e) {
    if (!disabled) {
        e.preventDefault();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    }
};

function onTouchStart(e) {
    if (!disabled) {
        e.preventDefault();
        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onTouchEnd);
    }
};

function onTouchEnd(e) {
    if (!disabled) {
        e.preventDefault();
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
    }
};

function onMouseMove(e) {
    if (!disabled) {
        e.preventDefault();
        updatePosition(e.offsetX, e.offsetY);
    }
};

function onTouchMove(e) {
    if (!disabled && e.touches.length == 1) {
        const boundingClientRect = knob.getBoundingClientRect();
        const touch = e.targetTouches.item(0);
        const offsetX = touch.clientX - boundingClientRect.left;
        const offsetY = touch.clientY - boundingClientRect.top;
        updatePosition(offsetX, offsetY);
    }
};

function dashLength() {
   
    let element = pathValue;
    let length = element.getTotalLength()
    if (animation.animated) {
        element.style.animationDuration = (animation.animationDuration / 1000) + 's'
        element.style.animationFunction = animation.animationFunction
    }
    element.dataset.dash = length
    length = length
};

function mapRange(x, inMin, inMax, outMin, outMax)  {
    return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};
</script>

<style>
@keyframes dash-frame {
    100% {
        stroke-dashoffset: 0;
    }
}

.knob-control {
    user-select: none; /* disable text selection on click + drag */
}

.knob-control__range {
    fill: none;
    transition: stroke .1s ease-in;
}

.knob-control__value {
    animation-name: dash-frame;
    animation-fill-mode: forwards;
    fill: none;
}

.knob-control__text-display {
    font-size: 1.3rem;
    text-align: center;
}
</style>
