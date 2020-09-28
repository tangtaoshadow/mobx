import {
    deepEqual,
    isES6Map,
    isES6Set,
    isObservable,
    isObservableArray,
    isObservableMap,
    isObservableSet,
    isObservableObject,
    isPlainObject,
    observable,
    die
} from "../internal"
// 增强子 相当于真正起作用的药物
export interface IEnhancer<T> {
    (newValue: T, oldValue: T | undefined, name: string): T
}

// 这个是在真正起作用的,类似药物,实际上这个**增强子**还是生成了一对 `ObservableMap` ,`ObservableSet`, `ObservableValue` ....,
// 这些封装的对象就是起作用的**药物**,再通过`observable`包装,
// 提供`api`『如: get set ....』.它就相当于**外壳**,两个组成就成了一个💊**胶囊**,

// 深增强
export function deepEnhancer(v, _, name) {
    // it is an observable already, done
    if (isObservable(v)) return v

    // something that can be converted and mutated?
    if (Array.isArray(v)) return observable.array(v, { name })
    if (isPlainObject(v)) return observable.object(v, undefined, { name })
    if (isES6Map(v)) return observable.map(v, { name })
    if (isES6Set(v)) return observable.set(v, { name })

    return v
}
// 浅增强 把深拷贝关闭
export function shallowEnhancer(v, _, name): any {
    if (v === undefined || v === null) return v
    if (isObservableObject(v) || isObservableArray(v) || isObservableMap(v) || isObservableSet(v))
        return v
    if (Array.isArray(v)) return observable.array(v, { name, deep: false })
    if (isPlainObject(v)) return observable.object(v, undefined, { name, deep: false })
    if (isES6Map(v)) return observable.map(v, { name, deep: false })
    if (isES6Set(v)) return observable.set(v, { name, deep: false })

    if (__DEV__)
        die(
            "The shallow modifier / decorator can only used in combination with arrays, objects, maps and sets"
        )
}
// 不对传入的值进行转换 直接返回
export function referenceEnhancer(newValue?) {
    // never turn into an observable
    return newValue
}

// structEnhancer 表示可观察的结构
export function refStructEnhancer(v, oldValue): any {
    if (__DEV__ && isObservable(v))
        die(`observable.struct should not be used with observable values`)
    // ! 需要进行深度比对 才能分析两个对象是否一致 why?
    // 因为一个对象 可能指针没有发生改变 但是内部属性可能发生了改变
    if (deepEqual(v, oldValue)) return oldValue
    return v
}
