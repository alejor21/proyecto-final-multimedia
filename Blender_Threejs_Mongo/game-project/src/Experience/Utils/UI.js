export default class UI {
    constructor() {
        this.statusElement = document.createElement('div')
        this.statusElement.style.position = 'absolute'
        this.statusElement.style.top = '50%'
        this.statusElement.style.left = '50%'
        this.statusElement.style.transform = 'translate(-50%, -50%)'
        this.statusElement.style.color = 'white'
        this.statusElement.style.fontSize = '48px'
        this.statusElement.style.fontFamily = 'Arial, sans-serif'
        this.statusElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)'
        this.statusElement.style.display = 'none'
        document.body.appendChild(this.statusElement)
    }

    showStatus(message) {
        this.statusElement.innerHTML = message
        this.statusElement.style.display = 'block'
    }

    hideStatus() {
        this.statusElement.style.display = 'none'
    }
}
