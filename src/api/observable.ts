import {
    IEnhancer,
    IEqualsComparer,
    IObservableArray,
    IObservableMapInitialValues,
    IObservableSetInitialValues,
    IObservableValue,
    ObservableMap,
    ObservableSet,
    ObservableValue,
    createDynamicObservableObject,
    createObservableArray,
    deepEnhancer,
    extendObservable,
    isES6Map,
    isES6Set,
    isObservable,
    isPlainObject,
    referenceEnhancer,
    Annotation,
    shallowEnhancer,
    refStructEnhancer,
    AnnotationsMap,
    asObservableObject,
    storeDecorator,
    createDecorator,
    createLegacyArray,
    globalState,
    assign,
    die,
    isStringish
} from "../internal"

export const OBSERVABLE = "observable"
export const OBSERVABLE_REF = "observable.ref"
export const OBSERVABLE_SHALLOW = "observable.shallow"
export const OBSERVABLE_STRUCT = "observable.struct"

export type CreateObservableOptions = {
    name?: string
    equals?: IEqualsComparer<any>
    deep?: boolean
    defaultDecorator?: Annotation
    proxy?: boolean
    autoBind?: boolean
}

// Predefined bags of create observable options, to avoid allocating temporarily option objects
// in the majority of cases
export const defaultCreateObservableOptions: CreateObservableOptions = {
    deep: true,
    name: undefined,
    defaultDecorator: undefined,
    proxy: true
}
// 冻结该对象 不允许修改任何属性
Object.freeze(defaultCreateObservableOptions)

// !这个就是从外界传入的选项属性 没有就会使用默认值
export function asCreateObservableOptions(thing: any): CreateObservableOptions {
    return thing || defaultCreateObservableOptions
}

// 此函数的目的就是决定是深拷贝还是浅拷贝
export function getEnhancerFromOption(options: CreateObservableOptions): IEnhancer<any> {
    return options.deep === true
        ? // 启用深拷贝
          deepEnhancer
        : options.deep === false
        ? // 浅拷贝
          referenceEnhancer
        : // 装饰器 增强 需要通过装饰器读取参数
          getEnhancerFromAnnotation(options.defaultDecorator)
}

const annotationToEnhancer = {
    [OBSERVABLE]: deepEnhancer,
    [OBSERVABLE_REF]: referenceEnhancer,
    [OBSERVABLE_SHALLOW]: shallowEnhancer,
    [OBSERVABLE_STRUCT]: refStructEnhancer
}

export function getEnhancerFromAnnotation(annotation?: Annotation): IEnhancer<any> {
    return !annotation ? deepEnhancer : annotationToEnhancer[annotation.annotationType_] ?? die(12)
}

/**
 * Turns an object, array or function into a reactive structure.
 * @param v the value which should become observable.
 */
function createObservable(v: any, arg2?: any, arg3?: any) {
    // @observable someProp;
    if (isStringish(arg2)) {
        // 走装饰器流程
        storeDecorator(v, arg2, OBSERVABLE)
        return
    }

    // it is an observable already, done
    if (isObservable(v)) return v

    // something that can be converted and mutated?
    const res = isPlainObject(v)
        ? observable.object(v, arg2, arg3)
        : Array.isArray(v)
        ? observable.array(v, arg2)
        : isES6Map(v)
        ? observable.map(v, arg2)
        : isES6Set(v)
        ? observable.set(v, arg2)
        : v

    // this value could be converted to a new observable data structure, return it
    if (res !== v) return res
    return observable.box(v)
}
createObservable.annotationType_ = OBSERVABLE

export interface IObservableFactory extends Annotation, PropertyDecorator {
    <T = any>(value: T[], options?: CreateObservableOptions): IObservableArray<T>
    <T = any>(value: Set<T>, options?: CreateObservableOptions): ObservableSet<T>
    <K = any, V = any>(value: Map<K, V>, options?: CreateObservableOptions): ObservableMap<K, V>
    <T extends Object>(
        value: T,
        decorators?: AnnotationsMap<T, never>,
        options?: CreateObservableOptions
    ): T

    box: <T = any>(value?: T, options?: CreateObservableOptions) => IObservableValue<T>
    array: <T = any>(initialValues?: T[], options?: CreateObservableOptions) => IObservableArray<T>
    set: <T = any>(
        initialValues?: IObservableSetInitialValues<T>,
        options?: CreateObservableOptions
    ) => ObservableSet<T>
    map: <K = any, V = any>(
        initialValues?: IObservableMapInitialValues<K, V>,
        options?: CreateObservableOptions
    ) => ObservableMap<K, V>
    object: <T = any>(
        props: T,
        decorators?: AnnotationsMap<T, never>,
        options?: CreateObservableOptions
    ) => T

    /**
     * Decorator that creates an observable that only observes the references, but doesn't try to turn the assigned value into an observable.ts.
     */
    ref: Annotation & PropertyDecorator
    /**
     * Decorator that creates an observable converts its value (objects, maps or arrays) into a shallow observable structure
     */
    shallow: Annotation & PropertyDecorator
    deep: Annotation & PropertyDecorator
    struct: Annotation & PropertyDecorator
}

const observableFactories: IObservableFactory = {
    box<T = any>(value?: T, options?: CreateObservableOptions): IObservableValue<T> {
        const o = asCreateObservableOptions(options)
        // 把 value 封装起来 返回一个 ObservableValue
        return new ObservableValue(value, getEnhancerFromOption(o), o.name, true, o.equals)
    },
    array<T = any>(initialValues?: T[], options?: CreateObservableOptions): IObservableArray<T> {
        const o = asCreateObservableOptions(options)
        return (globalState.useProxies === false || o.proxy === false
            ? createLegacyArray
            : createObservableArray)(initialValues, getEnhancerFromOption(o), o.name)
    },
    map<K = any, V = any>(
        initialValues?: IObservableMapInitialValues<K, V>,
        options?: CreateObservableOptions
    ): ObservableMap<K, V> {
        const o = asCreateObservableOptions(options)
        return new ObservableMap<K, V>(initialValues, getEnhancerFromOption(o), o.name)
    },
    set<T = any>(
        initialValues?: IObservableSetInitialValues<T>,
        options?: CreateObservableOptions
    ): ObservableSet<T> {
        const o = asCreateObservableOptions(options)
        return new ObservableSet<T>(initialValues, getEnhancerFromOption(o), o.name)
    },
    object<T = any>(
        props: T,
        decorators?: AnnotationsMap<T, never>,
        options?: CreateObservableOptions
    ): T {
        const o = asCreateObservableOptions(options)
        const base = {}
        asObservableObject(base, options?.name, getEnhancerFromOption(o))
        return extendObservable(
            globalState.useProxies === false || o.proxy === false
                ? base
                : createDynamicObservableObject(base),
            props,
            decorators,
            options
        )
    },
    ref: createDecorator(OBSERVABLE_REF),
    shallow: createDecorator(OBSERVABLE_SHALLOW),
    deep: createDecorator(OBSERVABLE),
    struct: createDecorator(OBSERVABLE_STRUCT)
} as any

// ! 这是 observable 的入口文件 实际调用了 createObservable 这个函数
// eslint-disable-next-line
export var observable: IObservableFactory = assign(createObservable, observableFactories)
