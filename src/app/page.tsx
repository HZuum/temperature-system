'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Upload, Camera, Image as ImageIcon, CheckCircle, Loader2, TableIcon, Thermometer, X, RotateCcw } from 'lucide-react';

// 类型定义
interface TemperatureData {
  time: number;
  hotWater: number;
  coldMilk: number;
  difference: number;
}

interface ImagePreview {
  url: string;
  file: File | null;
}

export default function TemperatureRecognitionPage() {
  // 状态管理
  const [imagePreview, setImagePreview] = useState<ImagePreview>({ url: '', file: null });
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isRecognized, setIsRecognized] = useState(false);
  const [temperatureData, setTemperatureData] = useState<TemperatureData[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // 相机功能相关状态
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  
  // 文件输入引用
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 初始化数据（暂时为空，等上传识别后填充）
  const [dataCount, setDataCount] = useState(10); // 默认显示10行（0-9分钟）
  
  // 初始化数据 - 根据实际数据量生成
  const getInitialData = useCallback((count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      time: i,
      hotWater: 0,
      coldMilk: 0,
      difference: 0,
    }));
  }, []);

  useEffect(() => {
    setTemperatureData(getInitialData(dataCount));
  }, [dataCount, getInitialData]);

  // 检测设备类型
  const getDeviceType = useCallback(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isApple = isIOS || /macintosh/i.test(ua);
    
    return { isMobile, isAndroid, isIOS, isApple };
  }, []);

  // 处理文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, []);

  // 处理文件
  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview({
        url: event.target?.result as string,
        file: file,
      });
      setIsRecognized(false);
      setErrorMessage('');
    };
    reader.readAsDataURL(file);
  }, []);

  // 从相册选择图片
  const handleSelectFromGallery = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  // 打开相机（使用原生capture属性）
  const handleOpenNativeCamera = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        processFile(file);
      }
    };
    
    input.click();
  }, [processFile]);

  // 打开自定义相机模态框
  const handleOpenCameraModal = useCallback(async () => {
    setShowCameraModal(true);
    setCameraError('');
    
    try {
      // 请求摄像头权限
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // 后置摄像头优先
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      
      setCameraStream(stream);
      
      // 将视频流绑定到video元素
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('无法访问相机:', err);
      setCameraError('无法访问相机，请确保已授予相机权限');
    }
  }, []);

  // 拍照
  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // 设置canvas尺寸与视频一致
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // 绘制当前帧
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // 转换为blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          processFile(file);
          handleCloseCameraModal();
        }
      }, 'image/jpeg', 0.95);
    }
  }, [processFile]);

  // 关闭相机模态框
  const handleCloseCameraModal = useCallback(() => {
    // 停止所有视频轨道
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
    setCameraError('');
  }, [cameraStream]);

  // 处理拖拽上传
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  }, [processFile]);

  // 识别图片中的数据
  const handleRecognize = async () => {
    if (!imagePreview.file) {
      setErrorMessage('请先上传温度表格图片');
      return;
    }

    setIsRecognizing(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('image', imagePreview.file);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '识别失败');
      }

      const data = await response.json();
      setTemperatureData(data.data);
      setDataCount(data.data.length); // 根据实际数据量设置行数
      setIsRecognized(true);
    } catch (error) {
      console.error('识别错误:', error);
      setErrorMessage(error instanceof Error ? error.message : '识别失败，请重试');
    } finally {
      setIsRecognizing(false);
    }
  };

  // 手动编辑数据
  const handleCellClick = (row: number, col: string) => {
    setEditingCell({ row, col });
    setEditValue(String(temperatureData[row][col as keyof TemperatureData]));
  };

  const handleCellSave = () => {
    if (editingCell) {
      const value = parseFloat(editValue);
      if (!isNaN(value)) {
        const newData = [...temperatureData];
        newData[editingCell.row] = {
          ...newData[editingCell.row],
          [editingCell.col]: value,
        };
        // 重新计算温差
        newData[editingCell.row].difference = parseFloat(
          (newData[editingCell.row].hotWater - newData[editingCell.row].coldMilk).toFixed(1)
        );
        setTemperatureData(newData);
        setIsRecognized(true);
      }
    }
    setEditingCell(null);
    setEditValue('');
  };

  // 清除数据
  const handleClear = () => {
    setImagePreview({ url: '', file: null });
    setIsRecognized(false);
    setErrorMessage('');
    setDataCount(10);
    setTemperatureData(getInitialData(10));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const deviceInfo = getDeviceType();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700">
      {/* 顶部状态栏 */}
      {isRecognized && (
        <div className="bg-green-500 text-white py-2 px-4 flex items-center justify-center gap-2">
          <CheckCircle size={18} />
          <span>识别完成</span>
        </div>
      )}

      {/* 主标题 */}
      <div className="bg-gradient-to-r from-purple-700 to-blue-700 text-white py-6 px-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-center">
            温度数据识别系统
          </h1>
          <p className="text-center text-purple-100 mt-2">
            上传或拍摄温度表格，自动识别并生成图表
          </p>
        </div>
      </div>

      {/* 移动端提示 */}
      {deviceInfo.isMobile && (
        <div className="bg-yellow-400 text-yellow-900 py-2 px-4 text-center text-sm">
          <p>请允许相机权限以便拍摄记录表</p>
        </div>
      )}

      {/* 主内容区域 */}
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：图片上传区域 */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Camera size={20} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-800">图片上传</h2>
              </div>

              {/* 隐藏的文件输入框 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* 上传区域 */}
              <div
                className={`border-2 border-dashed rounded-xl transition-all ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {!imagePreview.url ? (
                  <div className="py-8 px-4 text-center">
                    <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 font-medium mb-6">上传温度表格</p>
                    
                    {/* 操作按钮 */}
                    <div className="flex flex-col gap-3 max-w-xs mx-auto">
                      {/* 从相册选择 */}
                      <button
                        onClick={handleSelectFromGallery}
                        className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
                      >
                        <ImageIcon size={20} />
                        <span>从相册选择</span>
                      </button>
                      
                      {/* 拍照上传 - 优先使用自定义相机 */}
                      <button
                        onClick={handleOpenCameraModal}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white px-6 py-4 rounded-xl hover:from-cyan-600 hover:to-teal-600 transition-colors shadow-lg"
                      >
                        <Camera size={20} />
                        <span>拍照上传</span>
                      </button>
                      
                      {/* 备用：使用原生相机（部分浏览器） */}
                      <button
                        onClick={handleOpenNativeCamera}
                        className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors text-sm"
                      >
                        <RotateCcw size={16} />
                        <span>备用拍照方式</span>
                      </button>
                    </div>
                    
                    {/* 拖拽提示 */}
                    <p className="text-gray-400 text-sm mt-6">或拖拽图片到此处</p>
                  </div>
                ) : (
                  <div className="p-4">
                    {/* 图片预览 */}
                    <div className="relative">
                      <img
                        src={imagePreview.url}
                        alt="预览"
                        className="max-h-72 mx-auto rounded-xl shadow-md"
                      />
                      {/* 删除按钮 */}
                      <button
                        onClick={handleClear}
                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                        title="删除图片"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    
                    {/* 重新选择按钮 */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
                      <button
                        onClick={handleSelectFromGallery}
                        className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <ImageIcon size={16} />
                        重新选择
                      </button>
                      <button
                        onClick={handleOpenCameraModal}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white px-4 py-2 rounded-lg hover:from-cyan-600 hover:to-teal-600 transition-colors text-sm"
                      >
                        <Camera size={16} />
                        重新拍照
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 提示信息 */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                <p className="flex items-start gap-2">
                  <span>💡</span>
                  <span>点击"拍照上传"可直接拍摄记录表，或从相册选择已有照片</span>
                </p>
              </div>

              {/* 错误信息 */}
              {errorMessage && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {/* 识别按钮 */}
              <button
                onClick={handleRecognize}
                disabled={!imagePreview.url || isRecognizing}
                className={`w-full mt-4 flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-white transition-all ${
                  !imagePreview.url || isRecognizing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 shadow-lg hover:shadow-xl'
                }`}
              >
                {isRecognizing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    识别中...
                  </>
                ) : (
                  <>
                    <Thermometer size={20} />
                    开始识别
                  </>
                )}
              </button>
            </div>

            {/* 设备兼容说明 */}
            <div className="bg-white/80 backdrop-blur rounded-xl shadow p-4 text-sm text-gray-600">
              <p className="font-medium mb-2">支持的设备：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>安卓手机/平板（Chrome、Safari等浏览器）</li>
                <li>苹果手机(iPhone)/平板(iPad)/电脑(Mac)</li>
                <li>Windows/Mac电脑浏览器</li>
              </ul>
              <p className="mt-2 text-blue-600">
                首次使用时请允许浏览器访问相机权限
              </p>
            </div>
          </div>

          {/* 右侧：图表和数据表格 */}
          <div className="space-y-6">
            {/* 温度曲线图 */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Thermometer size={20} className="text-orange-600" />
                <h2 className="text-lg font-semibold text-gray-800">温度曲线</h2>
              </div>

              <div className="h-64 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={temperatureData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      dataKey="time"
                      label={{ value: '时间(分钟)', position: 'insideBottom', offset: -5 }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      label={{ value: '温度(℃)', angle: -90, position: 'insideLeft' }}
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="hotWater"
                      name="热水温度"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ fill: '#ef4444', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="coldMilk"
                      name="牛奶温度"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 图例说明 */}
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-sm text-gray-600">热水温度</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-amber-500 rounded"></div>
                  <span className="text-sm text-gray-600">牛奶温度</span>
                </div>
              </div>
            </div>

            {/* 数据表格 */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TableIcon size={20} className="text-green-600" />
                <h2 className="text-lg font-semibold text-gray-800">数据表格</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                      <th className="px-3 py-3 text-center font-semibold">时间(分)</th>
                      <th className="px-3 py-3 text-center font-semibold">热水(℃)</th>
                      <th className="px-3 py-3 text-center font-semibold">牛奶(℃)</th>
                      <th className="px-3 py-3 text-center font-semibold">温差(℃)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {temperatureData.map((row, index) => (
                      <tr
                        key={row.time}
                        className={`${
                          index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                        } hover:bg-blue-50 transition-colors`}
                      >
                        <td className="px-3 py-2 text-center font-medium border-b border-gray-200">
                          {row.time}
                        </td>
                        <td
                          className="px-3 py-2 text-center border-b border-gray-200 cursor-pointer hover:bg-yellow-100"
                          onClick={() => handleCellClick(index, 'hotWater')}
                        >
                          {editingCell?.row === index && editingCell?.col === 'hotWater' ? (
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellSave}
                              onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                              className="w-16 px-1 py-0.5 text-center border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          ) : (
                            row.hotWater.toFixed(1)
                          )}
                        </td>
                        <td
                          className="px-3 py-2 text-center border-b border-gray-200 cursor-pointer hover:bg-yellow-100"
                          onClick={() => handleCellClick(index, 'coldMilk')}
                        >
                          {editingCell?.row === index && editingCell?.col === 'coldMilk' ? (
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellSave}
                              onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                              className="w-16 px-1 py-0.5 text-center border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          ) : (
                            row.coldMilk.toFixed(1)
                          )}
                        </td>
                        <td className="px-3 py-2 text-center border-b border-gray-200">
                          <span
                            className={`font-medium ${
                              row.difference > 0
                                ? 'text-red-500'
                                : row.difference < 0
                                ? 'text-blue-500'
                                : 'text-gray-500'
                            }`}
                          >
                            {row.difference > 0 ? '+' : ''}
                            {row.difference.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 提示 */}
              <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
                <p>💡 点击表格中的数值可手动修改数据</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 页脚 */}
      <div className="text-center text-white/60 py-4 text-sm">
        <p>温度不同的物体相互接触 - 科学实验数据记录</p>
      </div>

      {/* 相机拍照模态框 */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-2xl overflow-hidden max-w-lg w-full">
            {/* 模态框标题 */}
            <div className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white p-4 flex items-center justify-between">
              <h3 className="font-semibold text-lg">拍照上传</h3>
              <button
                onClick={handleCloseCameraModal}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* 相机预览区域 */}
            <div className="relative bg-black aspect-[4/3]">
              {cameraError ? (
                <div className="flex flex-col items-center justify-center h-full text-white p-6 text-center">
                  <Camera size={48} className="mb-4 text-gray-400" />
                  <p className="text-red-400 mb-2">{cameraError}</p>
                  <p className="text-sm text-gray-400">
                    请在浏览器设置中允许相机权限，然后刷新页面重试
                  </p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* 拍摄参考线 */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-dashed border-white/50 rounded-lg w-4/5 h-4/5"></div>
                  </div>
                </>
              )}
            </div>
            
            {/* 隐藏的canvas */}
            <canvas ref={canvasRef} className="hidden" />
            
            {/* 拍摄按钮 */}
            <div className="p-4 flex justify-center gap-4">
              <button
                onClick={handleCloseCameraModal}
                className="px-6 py-3 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={handleCapture}
                disabled={!!cameraError}
                className={`px-8 py-3 rounded-xl font-semibold text-white transition-all ${
                  cameraError
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Camera size={20} />
                  拍照
                </span>
              </button>
            </div>
            
            {/* 提示 */}
            <div className="px-4 pb-4 text-center text-sm text-gray-500">
              <p>请将记录表对准相机框内拍摄</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
