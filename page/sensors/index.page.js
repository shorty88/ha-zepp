// import { getScrollListDataConfig } from '../../utils'
import { DEVICE_HEIGHT, DEVICE_WIDTH, TOP_BOTTOM_OFFSET } from "./index.style";

const {
  messageBuilder,
  FS_REF_SENSORS_UPDATE_ALARM_ID,
  FS_REF_SENSORS_UPDATE_STATE,
} = getApp()._options.globalData;

const logger = DeviceRuntimeCore.HmLogger.getLogger("ha-zepp-main");

Page({
  state: {
    scrollList: null,
    dataList: [],
    widgets: [],
    rendered: false,
    y: TOP_BOTTOM_OFFSET,
  },
  build() {
    logger.debug("page build invoked");
    this.drawWait();

    if (hmBle.connectStatus() === true) {
      const lastState = hmFS.SysProGetBool(FS_REF_SENSORS_UPDATE_STATE);
      messageBuilder
        .request({ method: "GET_UPDATE_SENSORS_STATE" })
        .then(({ result }) => {
          this.toggleSensorUpdates((turnOn = result), (isOn = lastState));
          this.getEntityList();
        });
    } else {
      this.drawNoBLEConnect();
    }
    hmUI.setLayerScrolling(true);
  },
  toggleSensorUpdates(turnOn, isOn) {
    if (turnOn === true && isOn === false) {
      //start sensor updates to HA
      hmFS.SysProSetBool(FS_REF_SENSORS_UPDATE_STATE, true);
      hmApp.gotoPage({
        file: "page/sensors_update/index.page",
        param: FS_REF_SENSORS_UPDATE_ALARM_ID,
      });
    } else if (turnOn === false && isOn === true) {
      // stop sensor updates to HA
      this.drawTextMessage("Turning sensor updates off..\nApp closing");
      hmFS.SysProSetBool(FS_REF_SENSORS_UPDATE_STATE, false);
      const existingAlarm = hmFS.SysProGetInt64(FS_REF_SENSORS_UPDATE_ALARM_ID);
      if (existingAlarm) {
        hmApp.alarmCancel(existingAlarm);
      }
      hmApp.gotoHome();
    }
  },
  getEntityList() {
    messageBuilder
      .request({ method: "GET_ENTITY_LIST" })
      .then(({ result, error }) => {
        if (error) {
          this.drawError(error);
          return;
        }
        this.state.dataList = result;
        this.createAndUpdateList();
      })
      .catch((res) => {
        this.drawError();
        console.log(res);
      });
  },
  toggleSwitchable(item, value) {
    messageBuilder.request({
      method: "TOGGLE_SWITCH",
      entity_id: item.key,
      value,
      service: item.type,
    });
  },
  clearWidgets() {
    this.state.widgets.forEach((widget, index) => {
      hmUI.deleteWidget(widget);
    });
    this.state.widgets = [];
    this.state.y = TOP_BOTTOM_OFFSET; // start from this y to skip rounded border
    hmUI.redraw();
  },
  createWidget(...args) {
    const widget = hmUI.createWidget(...args);
    this.state.widgets.push(widget);
    return widget;
  },
  createEntity(item) {
    const titleHeight = 32;
    const valueHeight = 35;
    const entitiesGap = 10;
    const totalHeight = titleHeight + valueHeight + entitiesGap;
    if (item.type !== "media_player") {
        this.createWidget(hmUI.widget.TEXT, {
            x: 0,
            y: this.state.y,
            w: DEVICE_WIDTH,
            h: titleHeight,
            text: item.title,
            text_size: 25,
            color: 0xaaaaaa,
            align_h: hmUI.align.CENTER_H,
        });
        this.createWidget(hmUI.widget.TEXT, {
            x: 0,
            y: this.state.y + titleHeight,
            w: DEVICE_WIDTH,
            h: valueHeight,
            text: item.state,
            text_size: 20,
            color: 0xffffff,
            align_h: hmUI.align.CENTER_H,
        });

        this.state.y += totalHeight;
    }

  },
  createSwitchable(item) {
    const titleHeight = 32;
    const valueHeight = 48;
    const entitiesGap = 10;
    const totalHeight = titleHeight + valueHeight + entitiesGap;
    this.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: this.state.y,
      w: DEVICE_WIDTH,
      h: titleHeight,
      text: item.title,
      text_size: 17,
      color: 0xaaaaaa,
      align_h: hmUI.align.CENTER_H,
    });
    this.createWidget(hmUI.widget.SLIDE_SWITCH, {
      x: DEVICE_WIDTH / 2 - 76 / 2,
      y: this.state.y + titleHeight,
      w: DEVICE_WIDTH,
      h: valueHeight,
      select_bg: "switch_on.png",
      un_select_bg: "switch_off.png",
      slide_src: "radio_select.png",
      slide_select_x: 32,
      slide_un_select_x: 8,
      checked: item.state === "on" ? true : false,
      checked_change_func: (slideSwitch, checked) => {
        if (!this.state.rendered) return;
        this.toggleSwitchable(item, checked);
      },
    });

    if ((item.type === "light") | (item.type === "media_player")) {
      const iconsize = 24;
      const details_button = this.createWidget(hmUI.widget.BUTTON, {
      x: DEVICE_WIDTH / 4,
      y: this.state.y + titleHeight,
      w: DEVICE_WIDTH / 2,
      h: valueHeight,
      text: "Details",
      normal_color: 0x18bcf2,
      press_color: 0x61cef2,
      radius: 20,
      click_func: (button) => {
       hmApp.gotoPage({
       file: `page/${item.type}/index.page`,
       param: JSON.stringify(item),
         });
      },
      
     });
    }
    this.state.y += totalHeight;
  },
  createExecutable(item) {
    const titleHeight = 32;
    const valueHeight = 48;
    const entitiesGap = 10;
    const totalHeight = titleHeight + valueHeight + entitiesGap;
    this.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: this.state.y,
      w: DEVICE_WIDTH,
      h: titleHeight,
      text: item.title,
      text_size: 17,
      color: 0xaaaaaa,
      align_h: hmUI.align.CENTER_H,
    });
    this.createWidget(hmUI.widget.BUTTON, {
      x: DEVICE_WIDTH / 4,
      y: this.state.y + titleHeight,
      w: DEVICE_WIDTH / 2,
      h: valueHeight,
      text: item.state === "on" ? "Cancel" : "Run",
      normal_color: 0x18bcf2,
      press_color: 0x61cef2,
      radius: 20,
      click_func: (button) => {
        messageBuilder.request({
          method: "PRESS_BUTTON",
          entity_id: item.key,
          service: item.type,
          current_state: item.state,
        });
      },
    });
    this.state.y += totalHeight;
  },
  createElement(item) {
    if (item === "end") {
      return this.createWidget(hmUI.widget.BUTTON, {
        x: 0,
        y: this.state.y,
        w: DEVICE_WIDTH,
        h: TOP_BOTTOM_OFFSET,
        //text: "TEST",
        click_func: () => {
          hmApp.gotoPage({ file: "page/sensors_update/index.page" });
        },
      });
    }
    if (typeof item !== "object" || typeof item.type !== "string") return;
 
    return this.createEntity(item);
  },
  createAndUpdateList() {
    this.clearWidgets();
    this.state.rendered = false;
      this.state.dataList.sort().forEach((item) => {
      this.createElement(item);
    });
    this.createElement("end");
    this.state.rendered = true;
  },
  drawTextMessage(message, button) {
    this.clearWidgets();
    this.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 0,
      w: DEVICE_WIDTH,
      h: DEVICE_HEIGHT,
      text: message,
      text_size: 18,
      color: 0xffffff,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
    });
    if (button) {
      const buttonParams = {};
      if (button.buttonColor) {
        buttonParams.normal_color = button.buttonColor;
      }
      if (button.buttonPressedColor) {
        buttonParams.press_color = button.buttonPressedColor;
      }
      if (button.textColor) {
        buttonParams.text_color = button.textColor;
      }
      if (typeof button.onClick === "function") {
        buttonParams.click_func = button.onClick;
      }
      this.createWidget(hmUI.widget.BUTTON, {
        x: DEVICE_WIDTH / 2 - 50,
        y: DEVICE_HEIGHT - TOP_BOTTOM_OFFSET * 3,
        text: button.text,
        w: 100,
        h: 50,
        radius: 4,
        normal_color: 0x333333,
        press_color: 0x444444,
        ...buttonParams,
      });
    }
    return;
  },
  drawNoBLEConnect() {
    return this.drawTextMessage("No connection to\n the application");
  },
  drawWait() {
    return this.drawTextMessage("Loading...");
  },
  drawError(message) {
    let text = "An error occurred";
    if (typeof message === "string") {
      text += ":\n";
      text += message;
    }
    return this.drawTextMessage(text);
  },
  onAppMessage({ payload: buf }) {
    const data = messageBuilder.buf2Json(buf);
    if (data.action === "listUpdate") {
      this.state.dataList = data.value;
      this.createAndUpdateList();
    }
  },
  onInit() {
    logger.debug("page onInit invoked");
    messageBuilder.on("call", this.onAppMessage);
    //hmApp.setScreenKeep(true);
  },

  onDestroy() {
    messageBuilder.off("call", this.onAppMessage);
    logger.debug("page onDestroy invoked");
  },
});
