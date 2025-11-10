export default class LevelManager {
  constructor(experience) {
    this.experience = experience
    this.currentLevel = 1
    this.totalLevels = 3
  }

  nextLevel() {
    if (this.currentLevel < this.totalLevels) {
      this.currentLevel++
      this.experience.world.clearCurrentScene()
      this.experience.world.loadLevel(this.currentLevel)
    }
  }

  resetLevel() {
    this.currentLevel = 1
    this.experience.world.loadLevel(this.currentLevel)
  }

  getCurrentLevelTargetPoints() {
    return this.pointsToComplete?.[this.currentLevel] || 2
  }
}

