# svelte-knob
Knob control for Svelte.js

## Install
```shell
npm install svelte-knob --save
```
## Demo

https://svelte.dev/repl/609b8f2e4540442197fc12cbc4165d55?version=3.31.1

## Usage

```javascript
import Knob from 'svelte-knob'
```

## Examples

Most basic usage:
```html
<Knob value={50} />
<Knob value={30} step={10} strokeWidth={8} primaryColor="#E844C3" secondaryColor="#E7B6DC" textColor="#E844C3"/>
<Knob value={45} min={-10} max={100} />
```
## Responsive

> Set the component responsive.

> Size property is always available, be careful if size is more than 100, size is expressed in % in this mode 
```html
<Knob
    responsive={true}
/>
```

## Animation:
> Disabled by default

`animated` true|false <br>
This will disable/enable knob animation but not value one. <br>

`animateValue` true|false <br>
Same as `animation` expect for the value. <br>

`animationDuration` integer, in milliseconds <br>
set the duration of both animation. <br>

`animationFunction` string <br>
CSS animation function, all CSS animations are available (eg: linear, ease-in, ease-out, ...). <br>

### Examples

> Only animate knob itself
```html
<Knob
    animation="{
        animated: true
    }"
/>
```
> Only animate knob value 
```html
<Knob
    animation="{
        animateValue: true
    }"
/>
```
_`animated` and `animateValue` can be set at the same time_

> This animation use `CSS linear function` during 5 sec
```html
<Knob
    animation="{
        animated: true,
        animateValue: true,
        animationDuration: '5000',
        animationFunction: 'linear'
    }"
/>
```
_`animationDuration` should be expressed in ms (you can use multiplication if you prefer eg: "5 * 1000")_

## Properties

The only required property is `value`.

Option | Type | Description | Default
-------|------|-------------|--------
value | Number | Use the value attribute to set the value of the control | none
max | Number | Maximum value of the control | 100
min | Number | Minimum value of the control | 0
step | Number | Smallest increment the value can change by | 1
disabled | Boolean | Set to true to disable the knob | false
size | Number | Visual size of the control in `px` (or `%` if `responsive` is `true`) | 100
primaryColor | String | Color of the value arc | #409eff
secondaryColor | String | Color of the rest of the control | #dcdfe6
textColor | String | Color of the value text | #000000
strokeWidth | Number | Thickness of the arcs | 17
valueDisplayFunction | Function | Custom function to alter the display text | `(v) => v`
responsive | Boolean | Use `%` instead of `px` | false
animation | Object | Optional animation config object: `{ animated: false, animateValue: false, animationDuration: 2000 (in ms), animationFunction: 'ease-in-out' }` | null