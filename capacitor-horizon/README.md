# capacitor-horizon

CapacitorHorizon Capacitor Plugin

## Install

To use npm

```bash
npm install capacitor-horizon
````

To use yarn

```bash
yarn add capacitor-horizon
```

Sync native files

```bash
npx cap sync
```

## API

<docgen-index>

* [`echo(...)`](#echo)
* [`getNativeContext()`](#getnativecontext)
* [Interfaces](#interfaces)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### echo(...)

```typescript
echo(options: { value: string; }) => Promise<{ value: string; }>
```

| Param         | Type                            |
| ------------- | ------------------------------- |
| **`options`** | <code>{ value: string; }</code> |

**Returns:** <code>Promise&lt;{ value: string; }&gt;</code>

--------------------


### getNativeContext()

```typescript
getNativeContext() => Promise<{ context: NativeContext; }>
```

**Returns:** <code>Promise&lt;{ context: <a href="#nativecontext">NativeContext</a>; }&gt;</code>

--------------------


### Interfaces


#### NativeContext

| Prop                     | Type                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| **`deviceInfo`**         | <code>{ model: string; platform: string; osVersion: string; }</code> |
| **`permissions`**        | <code>{ contacts: string; calls: string; }</code>                    |
| **`isBatteryOptimized`** | <code>boolean</code>                                                 |

</docgen-api>
