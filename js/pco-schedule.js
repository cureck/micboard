/**
 * Simplified PCO Schedule Display
 * Shows unified "up next" list of all plans
 */

export class PCOScheduleDisplay {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.plans = [];
        this.currentPlanId = null;
        this.refreshInterval = null;
    }

    async init() {
        await this.loadSchedule();
        this.startAutoRefresh();
    }

    async loadSchedule() {
        try {
            const response = await fetch('/api/pco/upcoming-plans');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.plans = data.plans;
                this.currentPlanId = data.current_plan_id;
                this.render();
            }
        } catch (error) {
            console.error('Error loading PCO schedule:', error);
            this.showError('Failed to load schedule');
        }
    }

    render() {
        if (!this.container) return;

        const html = `
            <div class="pco-schedule">
                <div class="schedule-header">
                    <h3>Upcoming Services</h3>
                    <button class="btn-refresh" onclick="pcoSchedule.forceRefresh()">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                </div>
                <div class="schedule-list">
                    ${this.renderPlansList()}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
    }

    renderPlansList() {
        if (this.plans.length === 0) {
            return '<div class="no-plans">No upcoming plans</div>';
        }

        return this.plans.map(plan => {
            const liveTime = new Date(plan.live_time);
            const serviceTime = new Date(plan.service_time);
            const now = new Date();
            
            // Determine plan status
            let status = 'upcoming';
            let statusText = 'Upcoming';
            let statusClass = '';
            
            if (plan.is_live) {
                if (plan.is_manual) {
                    status = 'manual-live';
                    statusText = 'LIVE (Manual)';
                    statusClass = 'status-manual';
                } else {
                    status = 'live';
                    statusText = 'LIVE';
                    statusClass = 'status-live';
                }
            } else if (liveTime <= now && now < serviceTime) {
                status = 'ready';
                statusText = 'Ready';
                statusClass = 'status-ready';
            }
            
            // Format times
            const liveTimeStr = this.formatTime(liveTime);
            const serviceTimeStr = this.formatTime(serviceTime);
            
            // Count assigned slots
            const slotCount = Object.keys(plan.slot_assignments || {}).length;
            
            return `
                <div class="plan-item ${statusClass}" data-plan-id="${plan.plan_id}">
                    <div class="plan-status">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="plan-info">
                        <div class="plan-title">
                            <strong>${plan.service_type_name}</strong>
                            ${plan.title ? ` - ${plan.title}` : ''}
                        </div>
                        <div class="plan-dates">${plan.dates}</div>
                        <div class="plan-times">
                            <span class="time-label">Live:</span> ${liveTimeStr}
                            <span class="time-separator">|</span>
                            <span class="time-label">Service:</span> ${serviceTimeStr}
                        </div>
                        <div class="plan-slots">
                            <i class="fas fa-microphone"></i> ${slotCount} slots assigned
                        </div>
                    </div>
                    <div class="plan-actions">
                        ${this.renderPlanActions(plan, status)}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderPlanActions(plan, status) {
        // Can't manually select if a scheduled plan is live
        const canSetManual = status !== 'live' && !this.plans.some(p => p.is_live && !p.is_manual);
        
        if (plan.is_manual) {
            return `
                <button class="btn-action btn-clear" onclick="pcoSchedule.clearManualPlan()">
                    Clear Manual
                </button>
            `;
        } else if (status === 'live') {
            return '<span class="live-indicator">Currently Live</span>';
        } else if (canSetManual) {
            return `
                <button class="btn-action btn-set-live" onclick="pcoSchedule.setManualPlan('${plan.plan_id}')">
                    Set Live
                </button>
            `;
        } else {
            return '<span class="action-disabled">Cannot set during live service</span>';
        }
    }

    formatTime(date) {
        const options = {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        };
        return date.toLocaleString('en-US', options);
    }

    async setManualPlan(planId) {
        try {
            const response = await fetch('/api/pco/set-manual-plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ plan_id: planId })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                await this.loadSchedule();
                this.showSuccess('Plan set as live');
            } else {
                this.showError(data.message || 'Failed to set plan');
            }
        } catch (error) {
            console.error('Error setting manual plan:', error);
            this.showError('Failed to set plan');
        }
    }

    async clearManualPlan() {
        try {
            const response = await fetch('/api/pco/clear-manual-plan', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                await this.loadSchedule();
                this.showSuccess('Manual plan cleared');
            }
        } catch (error) {
            console.error('Error clearing manual plan:', error);
            this.showError('Failed to clear plan');
        }
    }

    async forceRefresh() {
        try {
            const btn = document.querySelector('.btn-refresh');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            }
            
            const response = await fetch('/api/pco/refresh-schedule', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                await this.loadSchedule();
                this.showSuccess(`Schedule refreshed: ${data.plan_count} plans loaded`);
            }
        } catch (error) {
            console.error('Error refreshing schedule:', error);
            this.showError('Failed to refresh schedule');
        } finally {
            const btn = document.querySelector('.btn-refresh');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sync"></i> Refresh';
            }
        }
    }

    startAutoRefresh() {
        // Refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadSchedule();
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    destroy() {
        this.stopAutoRefresh();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Global instance
window.pcoSchedule = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('pco-schedule-container');
    if (container) {
        window.pcoSchedule = new PCOScheduleDisplay('pco-schedule-container');
        window.pcoSchedule.init();
    }
});
