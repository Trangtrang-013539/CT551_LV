import localforage from "localforage";

// Tạo instance riêng cho app
const imageStore = localforage.createInstance({
  name: "myApp",
  storeName: "imagesStore", // bảng lưu ảnh
});

export default imageStore;
