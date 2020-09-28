import {
    Atom,
    IEnhancer,
    IInterceptable,
    IEqualsComparer,
    IInterceptor,
    IListenable,
    Lambda,
    checkIfStateModificationsAreAllowed,
    comparer,
    createInstanceofPredicate,
    getNextId,
    hasInterceptors,
    hasListeners,
    interceptChange,
    isSpyEnabled,
    notifyListeners,
    registerInterceptor,
    registerListener,
    spyReport,
    spyReportEnd,
    spyReportStart,
    toPrimitive,
    globalState,
    IUNCHANGED,
    UPDATE
} from "../internal"

export interface IValueWillChange<T> {
    object: IObservableValue<T>
    type: "update"
    newValue: T
}

export type IValueDidChange<T = any> = {
    type: "update"
    observableKind: "value"
    object: IObservableValue<T>
    debugObjectName: string
    newValue: unknown
    oldValue: unknown
}
export type IBoxDidChange<T = any> =
    | {
          type: "create"
          observableKind: "value"
          object: IObservableValue<T>
          debugObjectName: string
          newValue: unknown
      }
    | IValueDidChange<T>

export interface IObservableValue<T> {
    get(): T
    set(value: T): void
    intercept_(handler: IInterceptor<IValueWillChange<T>>): Lambda
    observe_(listener: (change: IValueDidChange<T>) => void, fireImmediately?: boolean): Lambda
}

const CREATE = "create"

export class ObservableValue<T>
    extends Atom
    implements IObservableValue<T>, IInterceptable<IValueWillChange<T>>, IListenable {
    hasUnreportedChange_ = false
    interceptors_
    changeListeners_
    value_
    dehancer: any

    constructor(
        value: T,
        public enhancer: IEnhancer<T>,
        public name_ = "ObservableValue@" + getNextId(),
        notifySpy = true,
        private equals: IEqualsComparer<any> = comparer.default
    ) {
        super(name_)
        // 先把值通过增强子 封装
        this.value_ = enhancer(value, undefined, name_)
        if (__DEV__ && notifySpy && isSpyEnabled()) {
            // only notify spy if this is a stand-alone observable
            spyReport({
                type: CREATE,
                object: this,
                observableKind: "value",
                debugObjectName: this.name_,
                newValue: "" + this.value_
            })
        }
    }

    private dehanceValue(value: T): T {
        if (this.dehancer !== undefined) return this.dehancer(value)
        return value
    }

    public set(newValue: T) {
        const oldValue = this.value_
        // 先拦截 调用准备值
        newValue = this.prepareNewValue_(newValue) as any
        if (newValue !== globalState.UNCHANGED) {
            // ! 切面 环绕执行
            // 获取事务通知是否已经开启
            const notifySpy = isSpyEnabled()
            if (__DEV__ && notifySpy) {
                // 开启之前
                spyReportStart({
                    type: UPDATE,
                    object: this,
                    observableKind: "value",
                    debugObjectName: this.name_,
                    newValue,
                    oldValue
                })
            }
            // 真正执行
            this.setNewValue_(newValue)
            // 执行之后
            if (__DEV__ && notifySpy) spyReportEnd()
        }
    }

    private prepareNewValue_(newValue): T | IUNCHANGED {
        // 先去检测允不允许修改该值 因为可能有限制 不允许非法操作
        checkIfStateModificationsAreAllowed(this)
        // 检测是否有 拦截器
        if (hasInterceptors(this)) {
            // 告知拦截器 我即将进行修改 并把必要信息发送给他
            const change = interceptChange<IValueWillChange<T>>(this, {
                object: this,
                type: UPDATE,
                newValue
            })
            // @ UNCHANGED 如果修改失败 就告知修改失败 直接返回
            if (!change) return globalState.UNCHANGED
            // 指向修改后的值
            newValue = change.newValue
        }
        // ! apply modifier
        // 通过调用增强子 因为set的值可能是一个 observable 也可能是需要observable 的
        // 所以增强子的作用是对其进行封装 获取的时候回同样通过消音器获取
        newValue = this.enhancer(newValue, this.value_, this.name_)
        // 分析是否发生修改 相同的值多次set就是 unchange
        return this.equals(this.value_, newValue) ? globalState.UNCHANGED : newValue
    }

    setNewValue_(newValue: T) {
        const oldValue = this.value_
        this.value_ = newValue
        // 汇报已经修改了
        this.reportChanged()
        if (hasListeners(this)) {
            // ! 同时告知监听者 相当于 autorun 等等
            notifyListeners(this, {
                type: UPDATE,
                object: this,
                newValue,
                oldValue
            })
        }
    }

    public get(): T {
        // 汇报即将获取
        this.reportObserved()
        // 通过消音器 返回值 因为初始化的时候是 增强子 enhance
        return this.dehanceValue(this.value_)
    }

    intercept_(handler: IInterceptor<IValueWillChange<T>>): Lambda {
        return registerInterceptor(this, handler)
    }

    observe_(listener: (change: IValueDidChange<T>) => void, fireImmediately?: boolean): Lambda {
        if (fireImmediately)
            listener({
                observableKind: "value",
                debugObjectName: this.name_,
                object: this,
                type: UPDATE,
                newValue: this.value_,
                oldValue: undefined
            })
        return registerListener(this, listener)
    }

    raw() {
        // used by MST ot get undehanced value
        return this.value_
    }

    toJSON() {
        return this.get()
    }

    toString() {
        return `${this.name_}[${this.value_}]`
    }

    valueOf(): T {
        return toPrimitive(this.get())
    }

    [Symbol.toPrimitive]() {
        return this.valueOf()
    }
}

export const isObservableValue = createInstanceofPredicate("ObservableValue", ObservableValue) as (
    x: any
) => x is IObservableValue<any>
