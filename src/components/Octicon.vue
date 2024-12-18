<script lang="ts">
import { createVNode } from 'vue'
import type { VNode } from 'vue'
import rawIconsData from '@primer/octicons/build/data.json'
interface IconSVG {
  tag: string
  attrs: {
    [key: string]: string | number
  }
}
interface IconData {
  [key: string]: {
    name: string
    keywords: string[]
    heights: {
      [key: string]: {
        width: number
        path: string
        ast: any
      }
    }
  }
}
const iconsData: IconData = rawIconsData
export default {
  name: 'OctIcon',
  props: {
    name: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      default: 16,
      validator(value: number): boolean {
        return [12, 16, 24].includes(value)
      }
    },
    width: Number,
    height: Number
  },
  computed: {
    iconData(): any {
      return iconsData[this.name]
    },
    iconSVG(): IconSVG | string {
      if (!this.iconData || !this.iconData.heights[this.size]) {
        return ''
      }
      const iconSizeData = this.iconData.heights[this.size]
      const viewBox = `0 0 ${iconSizeData.width} ${this.size}`
      const customWidth = this.width ? this.width : iconSizeData.width
      const customHeight = this.height ? this.height : this.size
      return {
        tag: 'svg',
        attrs: {
          width: customWidth,
          height: customHeight,
          viewBox: viewBox,
          fill: 'currentColor',
          class: `octicon octicon-${this.name}`,
          innerHTML: iconSizeData.path
        }
      }
    }
  },
  watch: {
    name: 'checkIconAvailability',
    size: 'checkIconAvailability'
  },
  methods: {
    checkIconAvailability(): void {
      if (!this.iconData) {
        throw new Error(`The icon "${this.name}" does not exist.`)
      }
      if (!this.iconData.heights[this.size]) {
        throw new Error(`The size "${this.size}" does not exist for the icon "${this.name}".`)
      }
    }
  },
  mounted(): void {
    this.checkIconAvailability()
  },
  render(): VNode {
    if (typeof this.iconSVG === 'string') return createVNode('div')
    return createVNode(this.iconSVG.tag, this.iconSVG.attrs)
  }
}
</script>