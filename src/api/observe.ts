import {
    IArrayDidChange,
    IComputedValue,
    IMapDidChange,
    IObjectDidChange,
    IObservableArray,
    IObservableValue,
    IValueDidChange,
    Lambda,
    ObservableMap,
    getAdministration,
    ObservableSet,
    ISetDidChange,
    isFunction
} from "../internal"

export function observe<T>(
    value: IObservableValue<T> | IComputedValue<T>,
    listener: (change: IValueDidChange<T>) => void,
    fireImmediately?: boolean
): Lambda
export function observe<T>(
    observableArray: IObservableArray<T>,
    listener: (change: IArrayDidChange<T>) => void,
    fireImmediately?: boolean
): Lambda
export function observe<V>(
    observableMap: ObservableSet<V>,
    listener: (change: ISetDidChange<V>) => void,
    fireImmediately?: boolean
): Lambda
export function observe<K, V>(
    observableMap: ObservableMap<K, V>,
    listener: (change: IMapDidChange<K, V>) => void,
    fireImmediately?: boolean
): Lambda
export function observe<K, V>(
    observableMap: ObservableMap<K, V>,
    property: K,
    listener: (change: IValueDidChange<V>) => void,
    fireImmediately?: boolean
): Lambda
export function observe(
    object: Object,
    listener: (change: IObjectDidChange) => void,
    fireImmediately?: boolean
): Lambda
export function observe<T, K extends keyof T>(
    object: T,
    property: K,
    listener: (change: IValueDidChange<T[K]>) => void,
    fireImmediately?: boolean
): Lambda

// ! 显式的指定谁发生变化就去执行 他不会去收集依赖
export function observe(thing, propOrCb?, cbOrFire?, fireImmediately?): Lambda {
    // thing 它可能是一个 observer.box()
    // propOrCb 收集依赖 并在依赖变化时执行
    if (isFunction(cbOrFire))
        return observeObservableProperty(thing, propOrCb, cbOrFire, fireImmediately)
    else return observeObservable(thing, propOrCb, cbOrFire)
}

function observeObservable(thing, listener, fireImmediately: boolean) {
    // 先向管理员 获取 thing 因为传入的是代理或包装
    // listener 监听 首次会运行 因为要收集依赖
    return getAdministration(thing).observe_(listener, fireImmediately)
}

function observeObservableProperty(thing, property, listener, fireImmediately: boolean) {
    // 获取属性 直接去触发了 observe_
    return getAdministration(thing, property).observe_(listener, fireImmediately)
}
